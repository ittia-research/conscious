-- Create the 'thoughts' table
CREATE TABLE IF NOT EXISTS thoughts (
    thought_id BIGSERIAL PRIMARY KEY,       -- Use BIGSERIAL for potentially large tables
    content TEXT NOT NULL,                  -- The text content
    embedding VECTOR(1536) NOT NULL,        -- The vector embedding. Replace the dimension number.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Timestamp when the record was created
);

-- Create a StreamingDiskANN index on embedding for faster similarity search 
CREATE INDEX thoughts_idx ON thoughts USING diskann (embedding vector_cosine_ops);  -- cosine distance

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