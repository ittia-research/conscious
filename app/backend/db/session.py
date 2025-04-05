# TO-DO: more efficient way to laod AGE,and avoid unnecessary load

import logging
from contextlib import contextmanager
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

from core.config import settings

logger = logging.getLogger(__name__)

# --- SQLAlchemy Setup ---
Base = declarative_base()
engine = create_engine(settings.DATABASE_URL, echo=False) # Set echo=True for debugging SQL
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- AGE Session Setup ---
def setup_age_connection(dbapi_connection, connection_record) -> None:
    """
    Sets up AGE essentials (LOAD, search_path) for new connections.
    """
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("LOAD 'age';")
        cursor.execute("SET search_path = ag_catalog, '$user', public;")
        logger.debug("AGE loaded and search_path set for new connection.")
    except Exception as e:
        logger.error(f"Error setting up AGE for connection: {e}")
    finally:
        cursor.close()

# Listen for new connections to automatically configure AGE
event.listen(engine, "connect", setup_age_connection)

@contextmanager
def get_db_session():
    """
    Provide a transactional scope around database operations.
    """
    session = SessionLocal()
    logger.debug("DB Session opened.")
    try:
        yield session
        session.commit()
        logger.debug("DB Session committed.")
    except Exception as e:
        logger.error(f"DB Session rollback due to exception: {e}", exc_info=True)
        session.rollback()
        raise
    finally:
        session.close()
        logger.debug("DB Session closed.")
