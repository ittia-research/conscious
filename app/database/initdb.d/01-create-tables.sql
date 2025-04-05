-- Create the 'thoughts' table --
-- SRS stands for Spaced Repetition Scheduler
CREATE TABLE IF NOT EXISTS thoughts (
    thought_id BIGSERIAL PRIMARY KEY,       -- Use BIGSERIAL for potentially large tables
    text TEXT NOT NULL,                     -- Text content
    embedding VECTOR(1536) NOT NULL,        -- Vector embedding. Replace the dimension number.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Timestamp when the record was created

    -- SRS columns
    srs_rating SMALLINT,       -- Last review rating. 1:Again, 2:Hard, 3:Good, 4:Easy
    srs_stability FLOAT,
    srs_difficulty FLOAT,
    srs_state SMALLINT,        -- Latest learning state. 1:Learning, 2:Review, 3:Relearning. Mapped to FSRS State
    srs_step SMALLINT,         -- Latest step in learning if applicable
    srs_last_review TIMESTAMPTZ, -- When the card was last reviewed
    srs_due TIMESTAMPTZ,       -- In UTC, When the card is next due for review
    srs_discard BOOLEAN      -- If discard for review
);
-- Create indexes
CREATE INDEX idx_thoughts_srs_due ON thoughts (srs_due); -- For querying of due cards

-- Create a StreamingDiskANN index on embedding for faster similarity search 
CREATE INDEX idx_thoughts_embedding ON thoughts USING diskann (embedding vector_cosine_ops);  -- cosine distance


-- Create flashcard review logs table with TimescaleDB --
CREATE TABLE review_logs (
    time TIMESTAMPTZ NOT NULL,    -- Timestamp of this review
    thought_id INTEGER NOT NULL,
    rating SMALLINT NOT NULL,     -- 1:Again, 2:Hard, 3:Good, 4:Easy. 0 for not available when card set to discard.
    stability_before REAL,        -- Use REAL for float in PG
    stability_after REAL,
    difficulty_before REAL,
    difficulty_after REAL,
    state_before SMALLINT,        -- Before this review. FSRS State enum value
    state_after SMALLINT,
    step_before SMALLINT,
    step_after SMALLINT,
    last_review TIMESTAMPTZ,
    review_duration INTEGER,      -- Miliseconds it took to review the card
    due_before TIMESTAMPTZ,
    due_after TIMESTAMPTZ,
    discard BOOLEAN,
    
    PRIMARY KEY (time, thought_id) -- composite primary key
);

-- Convert the table into a hypertable that is partitioned by time
SELECT create_hypertable('review_logs', by_range('time'));


-- Setup graph --
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';  -- Load the AGE extension into the current session's library path
SET search_path = ag_catalog, "$user", public;  -- Set the search path for the current session
SELECT create_graph('conscious_graph');  -- Graph for sources relationships
SELECT create_vlabel('conscious_graph','Source');
SELECT create_vlabel('conscious_graph','Thought');
SELECT create_elabel('conscious_graph','DERIVED_TO');
SELECT create_elabel('conscious_graph','CONTAINS');
RESET search_path;  -- Reset so that table created after this will have the right schema

-- Create index for label Source
-- TO-DO: create index for `keys` only abd verify
-- Reference: https://github.com/apache/age/issues/2137
-- CREATE INDEX IF NOT EXISTS idx_conscious_graph_source ON conscious_graph."Source" USING gin (properties); 


\echo "Database initialization complete."