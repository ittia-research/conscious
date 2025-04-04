import asyncio
import json
import logging
import time
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from sqlalchemy import text

from db.models import Sources, Thoughts
from db.s3 import upload_texts_to_s3
from utils.helpers import execute_cypher
from utils.embeddings import get_embeddings
from core.config import settings

# temp
import nest_asyncio
nest_asyncio.apply()

logger = logging.getLogger(__name__)

# TO-DO: connection re-create after database server restart.
class ThoughtsService:
    def __init__(self, session: Session):
        self.session = session

    def add_source(self, keys: dict, properties: dict = {}, contents: List[str] = []):
        """
        Creates/merges a Source vertex, add or update properties.
        With keys as a group of identifiers for this source.
        Upload contents to S3 and save list of links.
        """

        if not keys or not isinstance(keys, dict):
            raise ValueError("Source vertex keys must be a non-empty dictionary.")

        try:
            # TO-DO: move save contents logic out
            # Upload contents to S3
            content_link = []
            if contents:
                content_link = upload_texts_to_s3(contents, bucket_name='sources')
                content_link = [i for i in content_link if i] # Remove empty ones if any
            properties['contents'] = content_link

            # Build the SET clauses
            set_clauses = ["v.created_at = timestamp()"]
            cypher_params = {
                "keys_param": keys
            }

            for key, value in properties.items():
                set_clauses.append(f"v.{key} = ${key}")
                cypher_params[key] = value

            set_clause_string = ",\n                ".join(set_clauses)

            # Cypher query: add or update properties
            cypher_query_string = f"""
                MERGE (v:Source {{ keys: $keys_param }})
                SET
                    {set_clause_string}
                RETURN id(v), properties(v)
            """

            # !IMPORTANT: use parameter for graph name will result in error
            sql_command = text(f"""
                SELECT * FROM cypher(
                    '{settings.GRAPH_NAME}',
                    $$ {cypher_query_string} $$,
                    :cypher_params
                )
                AS (id agtype, properties agtype);;
            """)

            result = self.session.execute(
                sql_command,
                { "cypher_params": json.dumps(cypher_params) }
            )

            vertex_data = result.fetchone()
            logger.debug(f"Added Source vertex, id {vertex_data[0]}, properties {vertex_data[1]}")
            
            return vertex_data

        except Exception as e:
            logger.error(f"Failed to add Source vertex: {e}")
            raise Exception(e)

    def add_thought(self, content: str, source_ids: List[int], embedding: Optional[List[float]] = None) -> Thoughts:
        """Adds a Thought to the DB, creates AGE vertex, and links to sources."""
        if not source_ids:
            raise ValueError("At least one source_id must be provided.")

        if embedding:
            if len(embedding) != settings.VECTOR_DIMENSION:
                raise ValueError(f"Provided embedding dimension {len(embedding)} != required {settings.VECTOR_DIMENSION}")
        else:
            embedding = asyncio.run(get_embeddings([content]))[0]

        # Check for duplication
        duplicate = self.find_similar_content(
                        texts_to_check = [content],
                        embeddings = [embedding],
                        id_column = 'thought_id',
                        text_column = 'content',
                        table_name = 'thoughts',
                        limit = 1,
                        distance_max = settings.DUPLICATE_EMBEDDING_DISTANCE_MAX,
                    )[0]['neighbors']
        if duplicate:
            logger.info(f"Duplicate found in table '{Thoughts.__tablename__}' with embedding distance {duplicate[0]['distance']}, original text: {content}")
            thought_id = duplicate[0]['id']
            # TO-DO: shall we create locally or fetch from db to match the result below?
            db_thought = Thoughts(thought_id=thought_id, content=duplicate[0]['text'])
        else:
            db_thought = Thoughts(content=content, embedding=embedding)
            self.session.add(db_thought)
            self.session.flush() # Get the thought_id
            thought_id = db_thought.thought_id # TO-DO: could it be invalid?
            logger.info(f"Thought created with id: {thought_id}")

            # Create thought vertex in AGE
            cypher_query_thought = f"""
            CREATE (t:Thought {{
                pg_table_id: {thought_id}
            }})
            RETURN t
            """
            try:
                graph_thought_result = execute_cypher(self.session, cypher_query_thought)
                logger.info(f"AGE vertex Thought creation result: {graph_thought_result}")
            except Exception as e:
                logger.error(f"Failed to create AGE vertex thought for thought_id {thought_id}: {e}")
                raise

        # Link thought to each source vertex in AGE
        for source_id in source_ids:
            # Optional: Verify source_id exists in DB first for robustness
            source_exists = self.session.get(Sources, source_id)
            if not source_exists:
                 logger.error(f"Cannot link thought {thought_id}: Source with pg_table_id {source_id} not found in DB.")
                 raise ValueError(f"Source with id {source_id} does not exist.")


            logger.info(f"Linking thought {thought_id} to source {source_id}")
            cypher_query_edge = f"""
            MATCH (t:Thought {{pg_table_id: {thought_id}}})
            MATCH (s:Source {{pg_table_id: {source_id}}})
            MERGE (s)-[r:DERIVED_TO]->(t)
            RETURN r
            """
            try:
                graph_edge_result = execute_cypher(self.session, cypher_query_edge)
                logger.info(f"AGE DERIVED_TO edge creation result: {graph_edge_result}")
            except Exception as e:
                logger.error(f"Failed linking thought {thought_id} to source {source_id}: {e}")
                raise

        return db_thought

    def add_collection(self, contents: List[str], source_keys: dict, source_properties: dict = {}) -> tuple[List[int], List[int]]:
        """Adds a source and multiple thoughts, and link together.
        
        Args:
          - contents: list of thoughts
        """
        logger.debug(f"Adding collection: source keys {source_keys}, source properties {source_properties}, {len(contents)} thoughts.")

        # Add the source first
        source = self.add_source(keys=source_keys, properties=source_properties)
        source_ids = [source[0]]

        # Generate embeddings for all contents at once (more efficient potentially)
        thought_ids = []
        if contents:
            embeddings = asyncio.run(get_embeddings(contents))
            # Basic verification
            if len(embeddings) != len(contents):
                raise ValueError("Embedding generation returned incorrect number of vectors.")

            # Add thoughts and link them
            for index, content in enumerate(contents):
                embed = embeddings[index]
                thought = self.add_thought(
                    content=content, 
                    source_ids=[source.source_id], 
                    embedding=embed
                )
                thought_ids.append(thought.thought_id)
        else:
            logger.warning("add_collection called with empty contents list.")

        return source_ids, thought_ids


    def link_source_to_source(self, parent_source_id: int, child_source_id: int) -> Optional[List]:
        """Creates a 'CONTAINS' relationship between two sources in AGE."""
        if (parent_source_id == child_source_id or
            not parent_source_id or not child_source_id):
             raise ValueError(f"Source IDs not valid: {parent_source_id}, {child_source_id}")
        
        # Optional: Verify both sources exist in DB first
        parent_exists = self.session.get(Sources, parent_source_id)
        child_exists = self.session.get(Sources, child_source_id)
        if not parent_exists or not child_exists:
            logger.error(f"Cannot link sources: Parent ({parent_source_id}) or Child ({child_source_id}) not found in DB.")
            raise ValueError("Parent or Child source does not exist.")

        logger.info(f"Linking source {parent_source_id} --CONTAINS-> source {child_source_id}")
        cypher_query = f"""
        MATCH (parent:Source {{pg_table_id: {parent_source_id}}})
        MATCH (child:Source {{pg_table_id: {child_source_id}}})
        MERGE (parent)-[r:CONTAINS]->(child) /* Use MERGE to avoid duplicate edges */
        RETURN r
        """
        try:
            graph_result = execute_cypher(self.session, cypher_query)
            logger.info(f"AGE CONTAINS edge creation/merge result: {graph_result}")
            return graph_result
        except Exception as e:
            logger.error(f"Failed creating/merging AGE CONTAINS edge from {parent_source_id} to {child_source_id}: {e}")
            raise

    def find_similar_content(
            self,
            texts_to_check: List[str],
            id_column: str,
            text_column: str,
            table_name: str,
            limit: int = 1,
            distance_max: float = 2,
            embedding_column: str = 'embedding',
            embeddings: List[List[float]] = None,
        ) -> Dict[int, Dict[str, Any]]:
        """
        Checks a list of texts for similar content in a pgvector database based on cosine distance.

        Args:
            texts_to_check: A list of strings to check for duplicates.
            distance_max: The max cosine distance score (0.0 to 2.0)
            limit: select rows from top results
            embeddings: list of embedding corresponding to the texts

        Returns:
            A dictionary where keys are the indices of the input texts in `texts_to_check`.
            Each value is another dictionary containing:
                'input_text': The original text provided.
                'neighbors': A list of dictionaries of similar content, each with 'distance' and selected columns.
        """
        results = {}
        if not texts_to_check:
            return results

        start_time = time.time()

        if embeddings:
            if len(texts_to_check) != len(embeddings):
                raise ValueError(f"Number of texts and embeddings does not match")
        else:
            embeddings = asyncio.run(get_embeddings(texts_to_check))

        for i, (input_text, query_embedding) in enumerate(zip(texts_to_check, embeddings)):
            # Search using cosine distance (<->)
            # The <-> operator calculates distance (0=identical, 1=orthogonal, 2=opposite).

            stmt = text(
                f"""
                SELECT
                    {id_column},
                    {text_column},
                    ({embedding_column} <-> :embedding ::vector) AS distance
                FROM {table_name}
                ORDER BY distance ASC
                LIMIT {limit}
                """
            )

            # Execute the query, binding the embedding vector
            try:
                query_results = self.session.execute(stmt, {"embedding": query_embedding}).fetchall()
            except Exception as e:
                logger.error(f"Error querying database for text index {i}: {e}")
                # Error handle
                results[i] = {
                    "input_text": input_text,
                    "neighbors": [],
                    "error": str(e)
                }
                continue

            found_neighbors = []

            # Process db results
            if query_results:
                for query_result in query_results:
                    db_id, db_text, distance = query_result
                    if distance <= distance_max:
                        found_neighbors.append({
                            "id": db_id,
                            "text": db_text,
                            "distance": distance
                        })

            results[i] = {
                "input_text": input_text,
                "neighbors": found_neighbors,
            }

        query_time = time.time()
        logger.info(f"Total processing time (find similar content): {query_time - start_time:.4f} seconds")

        return results