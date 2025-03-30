# app/utils/helpers.py
import uuid
import logging
from typing import List, Any, Dict, Type, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from core.config import settings
from db.session import Base # Needed for type hinting if check_duplicate_row takes Base subclasses

logger = logging.getLogger(__name__)


def generate_source_guid(source_type: str, identifier: str) -> uuid.UUID:
    # TO-DO: implement namespace
    """Generates a UUID5 based on the source type and identifier."""
    namespace = uuid.NAMESPACE_DNS
    name = f"{source_type}:{identifier}"
    return uuid.uuid5(namespace, name)


def execute_cypher(session: Session, query: str, columns: int = 1) -> List:
    """Executes a Cypher query using AGE."""
    # Define return definition dynamically
    _parts = [f"r{i} agtype" for i in range(columns)]
    return_as = ", ".join(_parts)

    # Get command
    command_text = f"SELECT * FROM cypher('{settings.GRAPH_NAME}', $${query.strip()}$$) as ({return_as});"
    command = text(command_text)
    logger.debug(f"Executing Cypher command: {command}")

    try:
        result = session.execute(command)
        return result.fetchall()
    except SQLAlchemyError as e:
        logger.error(f"Error executing Cypher query: {e}", exc_info=True)
        raise # Re-raise to be handled by caller or session context


def check_duplicate_row(session: Session, model: Type[Base], row_dict: Dict[str, Any]) -> Optional[Any]:
    """
    Checks if a row represented by a dictionary exists in the table
    corresponding to the SQLAlchemy model.

    Args:
        session: SQLAlchemy session
        model: The SQLAlchemy model class representing the target table.
        row_dict: A dictionary where keys are column names (matching model
                  attributes) and values are the data for the row to check.
                  Only keys present in the dictionary will be used for matching.

    Returns:
        - The existing SQLAlchemy object (the duplicate row) if found.
        - False if no duplicate row matching all key-value pairs in row_dict
          is found.
        - None if a database error occurs during the query.
    """
    if not row_dict:
        logger.warning(f"Empty dictionary provided for duplicate check in {model.__name__}.")
        return None

    try:
        # Build the query dynamically filtering by all key-value pairs in the dict
        query = session.query(model)
        for column, value in row_dict.items():
            # Check if the model actually has this attribute to avoid errors
            if hasattr(model, column):
                query = query.filter(getattr(model, column) == value)
            else:
                logger.error(f"Model '{model.__name__}' lacks attribute '{column}'. Cannot check duplicate.")
                return None # Indicate error due to invalid column

        # Execute the query and fetch the first matching result
        existing_row = query.first()

        if existing_row:
            logger.info(f"Duplicate found in table '{model.__tablename__}': {existing_row}")
            return existing_row
        else:
            logger.debug(f"No duplicate found in table '{model.__tablename__}' for criteria: {row_dict}")
            return False # No duplicate found

    except SQLAlchemyError as e:
        logger.error(f"DB error checking duplicates in '{model.__tablename__}': {e}", exc_info=True)
        return None # Indicate database error
    except Exception as e:
        logger.error(f"Unexpected error during duplicate check for '{model.__tablename__}': {e}", exc_info=True)
        return None # Indicate other errors