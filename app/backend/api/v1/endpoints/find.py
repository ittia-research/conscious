import logging
import sys
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from typing import List, Any

from services.find_thoughts import FindThoughts
from utils.validators import decode_unicode_escapes_logic

logger = logging.getLogger(__name__)


router = APIRouter()


class FindRequest(BaseModel):
    text: str = Field(..., description="The text content to be summarized.")
    identifier: str = Field(..., description="A unique identifier for this text/request.")

    # Decode unicode escape
    @field_validator('text', 'identifier', mode='before')
    @classmethod
    def decode_fields(cls, v: Any):
        return decode_unicode_escapes_logic(v)


class FindResponse(BaseModel):
    thoughts: List[str]


@router.post("/", response_model=FindResponse, status_code=status.HTTP_201_CREATED)
async def find_thoughts_from_text(request: FindRequest):
    """
    Receives text and an identifier, extracts main thoughts using an LLM,
    saves them to a (simulated) database, and returns the thoughts.
    """
    identifier = request.identifier.strip()
    text = request.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")
    logger.debug(f"Received find request for identifier: {request.identifier} -> text: {text}")

    if not identifier:
        identifier = "TO-DO"

    find_thoughts = FindThoughts(text=text, identifier=identifier)
    thoughts = find_thoughts.find()

    return FindResponse(thoughts=thoughts)
