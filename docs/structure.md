Implementations and thinking about structure of this project.

## Data
### Rules
General:
- Avoid unnecessary obstruction.

### Structures
Tables are defined [here](../app/database/initdb.d/01-create-tables.sql).

thoughts (table)
- contains details of thoughts: content(text, image url, etc.), embedding, created_at

Thought (Knowledge Graph vertex)
- contains thoughts table_id
- used for establish relationships with sources, etc.

Sources (Knowledge Graph vertex)
- contains:
  - keys (dict): `type` and other identifiers for this source
  - properties: other data related
- used for define sources, establish relationship with thoughts and other sources

S3 (object storage):
- buckets:
  - sources
- used to save original data, for example long text or uploaded files.

### Identifier
The goal is to identify an entity internally, globally, and across time.
It's likely identifier won't be able to cover our needs forever. Partly because we might add new dimensions into our understanding.
Think about future-proof when designing such system is much encouraged.

### Relationships
Design:
- Generally follow the direction from high to low like water.

Defined by AGE knowledge graph edges:
- source --DERIVED_TO--> thought
- source --CONTAIN--> source

### Vector
- thoughts: embedding for text, with cosine distance index enabled

## Parameters
### Experimental
- DUPLICATE_EMBEDDING_DISTANCE_MAX: if embeddings of 2 texts cousin distance not above this limit, we consider them identical.
