import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from typing import List, Any, Dict

from services.find_thoughts import FindThoughts
from utils.validators import decode_unicode_escapes_logic

logger = logging.getLogger(__name__)


router = APIRouter()


class FindRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Original text")
    type: str = Field(..., min_length=1, description="Type of the source")
    identifiers: Dict[str, str] = Field(..., min_length=1, description="Identifiers in addition to source type")

    # Decode unicode escape
    @field_validator('text', mode='before')
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
    text = request.text.strip()
    type = request.type
    identifiers = request.identifiers

    # Add type to identifiers
    identifiers['type'] = type

    if not text:
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")
    logger.debug(f"Received find request for {identifiers} -> text: {text}")

    find_thoughts = FindThoughts(text=text, identifiers=identifiers)
    thoughts = find_thoughts.find()

    return FindResponse(thoughts=thoughts)
