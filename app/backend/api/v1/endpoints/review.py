"""
Flashcard review
"""
import logging
from fastapi import APIRouter, HTTPException
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select
from datetime import datetime, timezone
from fsrs import State

from db.session import get_db_session
from db.models import Thoughts
from api.v1.schemas.review import *
from services.fsrs_services import review_card


logger = logging.getLogger(__name__)


router = APIRouter()


@router.get("/next", response_model=Optional[ReviewCardResponse])
async def get_next_review_card():
    """Fetches the next thought due for review."""
    now_utc = datetime.now(timezone.utc)

    with get_db_session() as db:
        # Query for the card with the earliest due date that is <= now
        # Prioritize cards that have a due date set (already reviewed)
        # Then handle new cards (srs_due is NULL)

        # Query existing card
        card = db.execute(
            select(Thoughts)
            .filter(
                Thoughts.srs_discard.is_not(True), # Select False and Null
                Thoughts.srs_due <= now_utc
            )
            .order_by(Thoughts.srs_due.asc())
            .limit(1)
        ).scalar_one_or_none()

        if not card:
            # Query new cards
            card = db.execute(
                select(Thoughts)
                .filter(Thoughts.srs_due.is_(None), Thoughts.srs_discard.is_not(True))
                .order_by(Thoughts.thought_id.asc())
                .limit(1)
            ).scalar_one_or_none()
    
        if card:
            # Expunge the object from the session BEFORE the session closes,
            # to loads its current state and detaches it.
            db.expunge(card)
            return card
        else:
            return None


@router.post("/{thought_id}/submit", response_model=ReviewUpdateResponse)
async def submit_review_grade(
    thought_id: int,
    submission: ReviewGradeSubmission
):
    """Submits a review rating for a specific thought."""
    rating = submission.grade
    if not (1 <= rating <= 4):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 4")

    with get_db_session() as db:
        thought = db.get(Thoughts, thought_id)
        if not thought:
            raise HTTPException(status_code=404, detail="Thought not found")
        if thought.srs_discard: # TO-DO
            raise HTTPException(status_code=400, detail="Cannot review a discarded card")

        # Review card
        thought, review_log = review_card(thought, rating)

        db.add(review_log)

        return ReviewUpdateResponse(
            message="Review submitted successfully",
            next_due=thought.srs_due,
            state=State(thought.srs_state).name
        )


@router.post("/{thought_id}/discard", response_model=DiscardResponse)
async def discard_thought(thought_id: int):
    # TO-DO: implement un-discard

    with get_db_session() as db:
        thought = db.get(Thoughts, thought_id)
    
        if not thought:
            raise HTTPException(status_code=404, detail="Thought not found")
        if thought.srs_discard:
            return DiscardResponse(message="Thought was already discarded", id=thought_id)

        # Update without review
        thought, review_log = review_card(thought, rating=None, discard=True)

        db.add(review_log)

        return DiscardResponse(message="Thought discarded successfully", id=thought_id) 