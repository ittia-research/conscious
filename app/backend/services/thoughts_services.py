import asyncio
import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from db.models import Sources, Thoughts
from utils.helpers import generate_source_guid, execute_cypher, check_duplicate_row
from utils.embeddings import get_embeddings
from core.config import settings

# temp
import nest_asyncio
nest_asyncio.apply()

logger = logging.getLogger(__name__)

class ThoughtsService:
    def __init__(self, session: Session):
        self.session = session

    def add_source(self, source_type: str, identifier: str) -> Sources:
        """Adds a Source to the table and AGE graph if it doesn't exist.
        Skip if the same row already exist in the table.
        """
        source_guid = generate_source_guid(source_type, identifier)
        columns = {
            'source_type': source_type,
            'identifier': identifier,
            'guid': source_guid
        }

        # Check if already exist in table
        existing_source = check_duplicate_row(self.session, Sources, columns)
        if isinstance(existing_source, Sources):
            # logger.info(f"Source already exists: {existing_source}")
            return existing_source
        elif existing_source is None: # Indicates an error occurred during check
             # Logged in check_duplicate_row, re-raise error
            raise Exception(f"Error checking for duplicate in table {Sources.__tablename__}: {columns}")
        # If existing_source is False, it means no duplicate found, proceed.

        logger.info(f"Adding new source: type='{source_type}', identifier='{identifier}'")
        db_source = Sources(**columns)
        self.session.add(db_source)
        self.session.flush() # Get the auto-generated source_id before graph creation
        logger.info(f"Relational source created with id: {db_source.source_id}")

        cypher_query = f"""
        CREATE (s:Source {{
            pg_table_id: {db_source.source_id},
            type: '{db_source.source_type}',
            identifier: '{db_source.identifier}',
            guid: '{str(db_source.guid)}'
        }})
        RETURN id(s)
        """

        try:
            graph_result = execute_cypher(self.session, cypher_query)
            logger.info(f"AGE vertex Source creation result: {graph_result}")
        except Exception as e:
            logger.error(f"Failed to create AGE vertex Source for source_id {db_source.source_id}: {e}")
            raise # Re-raise to ensure transaction rollback

        return db_source

    def add_thought(self, content: str, source_ids: List[int], embedding: Optional[List[float]] = None) -> Thoughts:
        """Adds a Thought to the DB, creates AGE vertex, and links to sources."""
        if not source_ids:
            raise ValueError("At least one source_id must be provided.")

        if embedding:
            if len(embedding) != settings.VECTOR_DIMENSION:
                raise ValueError(f"Provided embedding dimension {len(embedding)} != required {settings.VECTOR_DIMENSION}")
        else:
            embedding = asyncio.run(get_embeddings([content]))[0]

        logger.info(f"Adding thought, linking to source IDs: {source_ids}")
        db_thought = Thoughts(content=content, embedding=embedding)
        self.session.add(db_thought)
        self.session.flush() # Get the thought_id
        thought_id = db_thought.thought_id # TO-DO: could it be invalid?
        logger.info(f"Relational thought created with id: {thought_id}")

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
            CREATE (t)-[r:DERIVED_FROM]->(s)
            RETURN r
            """
            try:
                graph_edge_result = execute_cypher(self.session, cypher_query_edge)
                logger.info(f"AGE DERIVED_FROM edge creation result: {graph_edge_result}")
            except Exception as e:
                logger.error(f"Failed linking thought {thought_id} to source {source_id}: {e}")
                raise

        return db_thought

    def add_collection(self, source_type: str, identifier: str, contents: List[str]) -> tuple[List[int], List[int]]:
        """Adds a source and multiple thoughts, and link together.
        
        Args:
          - contents: list of thoughts
        """
        logger.info(f"Adding collection: source='{source_type}:{identifier}', {len(contents)} thoughts.")

        # Add the source first
        source = self.add_source(source_type=source_type, identifier=identifier)
        source_ids = [source.source_id]

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