-- Create the 'thoughts' table
CREATE TABLE IF NOT EXISTS thoughts (
    thought_id BIGSERIAL PRIMARY KEY,       -- Use BIGSERIAL for potentially large tables
    content TEXT NOT NULL,                  -- The text content
    embedding VECTOR(1024) NOT NULL,        -- The vector embedding. Replace the dimension number.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Timestamp when the record was created
);

-- Create Index on embedding for faster similarity search
CREATE INDEX ON thoughts USING hnsw (embedding vector_cosine_ops); -- cosine distance

-- Create the 'sources' table
CREATE TABLE IF NOT EXISTS sources (
    source_id BIGSERIAL PRIMARY KEY,     -- Use BIGSERIAL for potentially large tables
    source_type VARCHAR(50) NOT NULL,    -- Type of the source, e.g., 'url', 'pdf', 'book'
    identifier TEXT NOT NULL,            -- Unique identifier for the source, e.g., URL, ISBN
    guid UUID UNIQUE NOT NULL,           -- UUID5 based on type and identifier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Timestamp when the record was created
);

-- Setup graph --
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';  -- Load the AGE extension into the current session's library path
SET search_path = ag_catalog, "$user", public;  -- Set the search path for the current session
SELECT create_graph('conscious_graph');  -- Graph for sources relationships
SELECT create_vlabel('conscious_graph','Source');
SELECT create_vlabel('conscious_graph','Thought');
SELECT create_elabel('conscious_graph','DERIVED_FROM');
SELECT create_elabel('conscious_graph','CONTAINS');

\echo "Database initialization complete."