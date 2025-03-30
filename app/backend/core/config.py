import logging
from pydantic import field_validator, computed_field, ValidationError, Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Logging
    LOG_LEVEL_GLOBAL: str = "INFO"
    LOG_LEVEL_LiteLLM: str = "INFO"

    # DB Connection
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"

    # DB others
    GRAPH_NAME: str = "conscious_graph"
    VECTOR_DIMENSION: int = 1024 # TO-DO: maybe get dimension from model data directly?

    # Embedding (default to OpenAI compatible API)
    EMBEDDING_MODEL: str = "openai/jinaai/jina-embeddings-v3"
    EMBEDDING_API_BASE: str = "http://localhost:7997/"
    EMBEDDING_API_KEY: str = 'no_key'

    # LLM (default to Gemini)
    LLM_MODEL: str = "gemini/gemini-2.0-flash-thinking-exp-01-21"
    LLM_API_KEY: str = 'no_key'

    # DSPy
    DSPY_CACHE: bool = True # Turn DSPy cache on or off
    DSPY_CACHEDIR: str = "/tmp/dspy"

    # Validator for LOG_LEVEL
    @field_validator('LOG_LEVEL_GLOBAL', 'LOG_LEVEL_LiteLLM', mode='before')
    @classmethod
    def validate_and_normalize_log_level(cls, value: str) -> str:
        """
        Validates the input log level string against standard logging levels,
        converts it to upper case, and ensures it's usable.
        """
        level_upper = str(value).upper()
        # Check if corresponds to a valid logging level attribute
        if not hasattr(logging, level_upper) or not isinstance(getattr(logging, level_upper), int):
             valid_levels = [level for level in logging._levelToName.values()] # Get valid names dynamically
             raise ValueError(f"Invalid log level '{value}'. Must be one of: {', '.join(valid_levels)}")
        return level_upper

    # Generated Database URL
    @computed_field(return_type=str)
    @property
    def DATABASE_URL(self) -> str:
        """Computes the database connection string from other settings."""
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

# --- Instantiate Settings ---
try:
    settings = Settings()
except ValidationError as e:
    logging.critical(f"Configuration Error: Failed to load settings. Details: {e}")
    raise SystemExit(f"Configuration Error: {e}") from e

# --- Configure Root Logger ---
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL_GLOBAL),
    format="%(asctime)s [%(name)s:%(levelname)s] %(message)s", # With logger name
    handlers=[logging.StreamHandler()]
)

# --- Configure Other Loggers ---
logging.getLogger('LiteLLM').setLevel(getattr(logging, settings.LOG_LEVEL_LiteLLM))
