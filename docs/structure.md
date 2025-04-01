Implementations and thinking about structure of this project.

## Data
### Identifier
The goal is to identify an entity internally, globally, and across time.
It's likely identifier won't be able to cover our needs forever. Partly because we might add new dimensions into our understanding.
Think about future-proof when designing such system is much encouraged.

### Tables
- thoughts
- sources

### Relationships
Defined by AGE knowledge graph edges:
- thoughts <--DERIVED_FROM-- one or more sources
- source --CONTAIN--> one or more sources

### Vector
- thoughts: embedding for text, with cosine distance HNSW index enabled

## Parameters
### Experimental
- DUPLICATE_EMBEDDING_DISTANCE_MAX: if embeddings of 2 texts cousin distance not above this limit, we consider them identical.
