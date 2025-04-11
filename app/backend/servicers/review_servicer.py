import logging
import grpc
from datetime import datetime, timezone
from sqlalchemy import select
from google.protobuf.timestamp_pb2 import Timestamp
from google.protobuf.empty_pb2 import Empty
from fsrs import State
from typing import Optional

# Import generated types
from generated import conscious_api_pb2
from generated import conscious_api_pb2_grpc

# Import DB, models, and modules
from db.session import get_db_session
from db.models import Thoughts # Assuming ReviewLogs is used within review_card
from modules.fsrs_services import review_card # Assuming this exists and works

logger = logging.getLogger(__name__)

# Helper to convert Python datetime to Protobuf Timestamp
def datetime_to_timestamp(dt: Optional[datetime]) -> Optional[Timestamp]:
    if dt:
        ts = Timestamp()
        ts.FromDatetime(dt)
        return ts
    return None

class ReviewServiceServicer(conscious_api_pb2_grpc.ReviewServiceServicer):
    """Implements the ReviewService RPCs."""

    def GetNextReviewCard(self, request: Empty,
                          context: grpc.ServicerContext) -> conscious_api_pb2.GetNextReviewCardResponse:
        """
        Handles the GetNextReviewCard RPC.
        Fetches the next thought due for review from the database.
        """
        logger.info("Received GetNextReviewCard request")
        now_utc = datetime.now(timezone.utc)
        card_model = None

        try:
            with get_db_session() as db:
                # Query existing card
                card_model = db.execute(
                    select(Thoughts)
                    .filter(
                        Thoughts.srs_discard.is_not(True),
                        Thoughts.srs_due <= now_utc
                    )
                    .order_by(Thoughts.srs_due.asc())
                    .limit(1)
                ).scalar_one_or_none()

                if not card_model:
                    # Query new cards
                    card_model = db.execute(
                        select(Thoughts)
                        .filter(Thoughts.srs_due.is_(None), Thoughts.srs_discard.is_not(True))
                        .order_by(Thoughts.thought_id.asc())
                        .limit(1)
                    ).scalar_one_or_none()

                if card_model:
                    # Important: Expunge before session closes if needed elsewhere,
                    # but here we just copy data, so it might not be strictly necessary
                    # depending on usage patterns after this function.
                    # db.expunge(card_model) # Keep if needed

                    logger.info(f"Found next review card: ID {card_model.thought_id}")
                    review_card_proto = conscious_api_pb2.ReviewCard(
                        thought_id=card_model.thought_id,
                        text=card_model.text
                        # Add other fields from `card_model` to `ReviewCard` proto if needed
                    )
                    return conscious_api_pb2.GetNextReviewCardResponse(
                        card_available=True,
                        card=review_card_proto
                    )
                else:
                    logger.info("No review cards due.")
                    return conscious_api_pb2.GetNextReviewCardResponse(card_available=False)

        except Exception as e:
            logger.error(f"Error fetching next review card: {e}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, "An internal error occurred while fetching the next review card.")
            # return conscious_api_pb2.GetNextReviewCardResponse() # Unreachable

    def SubmitReviewGrade(self, request: conscious_api_pb2.SubmitReviewGradeRequest,
                          context: grpc.ServicerContext) -> conscious_api_pb2.ReviewUpdateResponse:
        """
        Handles the SubmitReviewGrade RPC.
        Submits a review grade for a thought and updates SRS data.
        """
        thought_id = request.thought_id
        rating = request.grade
        logger.info(f"Received SubmitReviewGrade request: thought_id={thought_id}, grade={rating}")

        if not (1 <= rating <= 4):
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Rating must be between 1 and 4")
            # return conscious_api_pb2.ReviewUpdateResponse() # Unreachable

        try:
            with get_db_session() as db:
                thought = db.get(Thoughts, thought_id)
                if not thought:
                    logger.warning(f"Thought ID {thought_id} not found for review submission.")
                    context.abort(grpc.StatusCode.NOT_FOUND, "Thought not found")
                    # return conscious_api_pb2.ReviewUpdateResponse() # Unreachable

                if thought.srs_discard:
                     logger.warning(f"Attempted to review discarded thought ID {thought_id}.")
                     context.abort(grpc.StatusCode.FAILED_PRECONDITION, "Cannot review a discarded card")
                     # return conscious_api_pb2.ReviewUpdateResponse() # Unreachable

                # Call the FSRS service logic
                updated_thought, review_log = review_card(thought, rating) # review_card handles DB state changes internally potentially

                # Assuming review_card modifies 'thought' in place or returns the updated one
                # and prepares review_log to be added.
                db.add(review_log)
                # The session commit happens automatically at the end of the 'with' block

                logger.info(f"Successfully submitted review for thought ID {thought_id}")
                return conscious_api_pb2.ReviewUpdateResponse(
                    message="Review submitted successfully",
                    next_due=datetime_to_timestamp(updated_thought.srs_due),
                    state=State(updated_thought.srs_state).name if updated_thought.srs_state is not None else "UNKNOWN"
                )

        except Exception as e:
            logger.error(f"Error submitting review for thought ID {thought_id}: {e}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, "An internal error occurred during review submission.")
            # return conscious_api_pb2.ReviewUpdateResponse() # Unreachable


    def DiscardThought(self, request: conscious_api_pb2.DiscardThoughtRequest,
                       context: grpc.ServicerContext) -> conscious_api_pb2.DiscardThoughtResponse:
        """
        Handles the DiscardThought RPC.
        Marks a thought as discarded.
        """
        thought_id = request.thought_id
        logger.info(f"Received DiscardThought request for thought_id={thought_id}")

        try:
            with get_db_session() as db:
                thought = db.get(Thoughts, thought_id)

                if not thought:
                    logger.warning(f"Thought ID {thought_id} not found for discarding.")
                    context.abort(grpc.StatusCode.NOT_FOUND, "Thought not found")
                    # return conscious_api_pb2.DiscardThoughtResponse() # Unreachable

                if thought.srs_discard:
                    logger.info(f"Thought ID {thought_id} was already discarded.")
                    return conscious_api_pb2.DiscardThoughtResponse(
                        message="Thought was already discarded",
                        id=thought_id
                    )

                # Call the FSRS service logic with discard=True
                # Assuming review_card handles setting srs_discard=True and creates a log entry
                updated_thought, review_log = review_card(thought, rating=None, discard=True)

                db.add(review_log)
                # Commit happens automatically

                logger.info(f"Successfully discarded thought ID {thought_id}")
                return conscious_api_pb2.DiscardThoughtResponse(
                    message="Thought discarded successfully",
                    id=updated_thought.thought_id # or request.thought_id
                )

        except Exception as e:
            logger.error(f"Error discarding thought ID {thought_id}: {e}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, "An internal error occurred while discarding the thought.")
            # return conscious_api_pb2.DiscardThoughtResponse() # Unreachable