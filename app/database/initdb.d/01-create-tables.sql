-- Create the 'thoughts' table
-- SRS stands for Spaced Repetition Scheduler
CREATE TABLE IF NOT EXISTS thoughts (
    thought_id BIGSERIAL PRIMARY KEY,       -- Use BIGSERIAL for potentially large tables
    text TEXT NOT NULL,                     -- Text content
    embedding VECTOR(1536) NOT NULL,        -- Vector embedding. Replace the dimension number.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Timestamp when the record was created

    -- SRS columns
    srs_due TIMESTAMP WITH TIME ZONE,       -- In UTC, When the card is next due for review
    srs_stability FLOAT,
    srs_difficulty FLOAT,
    srs_lapses INTEGER DEFAULT 0,           -- Number of times forgotten
    srs_state INTEGER,                      -- Mapped to FSRS states
    srs_last_review TIMESTAMP WITH TIME ZONE, -- When the card was last reviewed
    srs_reps INTEGER DEFAULT 0;             -- Number of times reviewed
    srs_discarded BOOLEAN                   -- If this row is discarded for SRS 
);
-- Create indexes
CREATE INDEX idx_thoughts_srs_due ON thoughts (srs_due); -- For querying of due cards

-- Create a StreamingDiskANN index on embedding for faster similarity search 
CREATE INDEX idx_thoughts_embedding ON thoughts USING diskann (embedding vector_cosine_ops);  -- cosine distance

-- Setup graph --
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';  -- Load the AGE extension into the current session's library path
SET search_path = ag_catalog, "$user", public;  -- Set the search path for the current session
SELECT create_graph('conscious_graph');  -- Graph for sources relationships
SELECT create_vlabel('conscious_graph','Source');
SELECT create_vlabel('conscious_graph','Thought');
SELECT create_elabel('conscious_graph','DERIVED_TO');
SELECT create_elabel('conscious_graph','CONTAINS');

-- Create index for label Source
-- TO-DO: create index for `keys` only abd verify
-- Reference: https://github.com/apache/age/issues/2137
-- CREATE INDEX IF NOT EXISTS idx_conscious_graph_source ON conscious_graph."Source" USING gin (properties); 

\echo "Database initialization complete."