## Data Structure
### Tables
- thoughts
- sources

### Relationships
Defined with AGE graph. Add some columns to AGE vertices as properties.

- thoughts derived from one or more sources
- source contain one or more sources

### Vector
- thoughts: embedding for content, with cosine distance HNSW index enabled

## Parameters
### Experimental
- DUPLICATE_EMBEDDING_DISTANCE_MAX: if embeddings of 2 texts cousin distance not above this limit, we consider them identical.
