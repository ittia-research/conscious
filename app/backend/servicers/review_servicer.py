import logging
import grpc
from datetime import datetime, timezone
from sqlalchemy import select, case, or_
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


# Default number of cards to fetch if not specified or invalid
DEFAULT_FETCH_COUNT = 3
MAX_FETCH_COUNT = 10 # A reasonable upper limit


# Helper to convert Python datetime to Protobuf Timestamp
def datetime_to_timestamp(dt: Optional[datetime]) -> Optional[Timestamp]:
    if dt:
        ts = Timestamp()
        ts.FromDatetime(dt)
        return ts
    return None


class ReviewServiceServicer(conscious_api_pb2_grpc.ReviewServiceServicer):
    """Implements the ReviewService RPCs."""

    def GetNextReviewCards(self, request: conscious_api_pb2.GetNextReviewCardsRequest,
                           context: grpc.ServicerContext) -> conscious_api_pb2.GetNextReviewCardsResponse:
        """
        Handles the GetNextReviewCards RPC.

        Fetches multiple cards for review, prioritizing existing due cards.

        Priority:
            1. Existing cards due for review (srs_due <= now), ordered by oldest srs_due.
            2. New cards (srs_due IS NULL), ordered by oldest thought_id.
        """
        logger.debug(f"Received GetNextReviewCards request: count={request.count}")
        now_utc = datetime.now(timezone.utc)

        # Determine the number of cards to fetch
        fetch_count = request.count
        if fetch_count <= 0:
            fetch_count = DEFAULT_FETCH_COUNT
            logger.debug(f"Request count invalid or zero, using default: {fetch_count}")
        elif fetch_count > MAX_FETCH_COUNT:
            fetch_count = MAX_FETCH_COUNT
            logger.warn(f"Request count exceeded max ({MAX_FETCH_COUNT}), limiting to max.")

        try:
            with get_db_session() as db:
                # Define the sorting logic:
                # 1. Prioritize non-null srs_due (existing) over null srs_due (new)
                #    - CASE WHEN srs_due IS NULL THEN 1 ELSE 0 END ASC
                # 2. For existing cards (where CASE is 0), sort by srs_due ASC
                # 3. For new cards (where CASE is 1), sort by thought_id ASC (srs_due is NULL anyway)
                priority_order = case((Thoughts.srs_due.is_(None), 1), else_=0).asc()
                due_order = Thoughts.srs_due.asc() # Handles existing cards
                new_order = Thoughts.thought_id.asc() # Handles new cards and tie-breaks existing

                stmt = (
                    select(Thoughts)
                    .filter(
                        Thoughts.srs_discard.is_not(True),  # Must not be discarded
                        or_(
                            Thoughts.srs_due <= now_utc,    # Either due
                            Thoughts.srs_due.is_(None)      # Or new
                        )
                    )
                    .order_by(
                        priority_order,  # Existing cards first (0), then new cards (1)
                        due_order,       # Sort existing cards by due date
                        new_order        # Sort new cards by ID (and tie-break existing)
                    )
                    .limit(fetch_count)
                )

                # Use .scalars().all() to get a list of Thoughts objects
                card_models = db.execute(stmt).scalars().all()

                review_cards_proto = []
                if card_models:
                    logger.info(f"Found {len(card_models)} review card(s).")
                    for card_model in card_models:
                        # Optionally expunge if needed outside the session scope
                        # db.expunge(card_model)
                        review_card_proto = conscious_api_pb2.ReviewCard(
                            thought_id=card_model.thought_id,
                            text=card_model.text or "" # Ensure text is not None
                        )
                        review_cards_proto.append(review_card_proto)
                else:
                    logger.info("No review cards due or available.")

                # Return the response with the list of cards (might be empty)
                return conscious_api_pb2.GetNextReviewCardsResponse(
                    cards=review_cards_proto
                )

        except Exception as e:
            logger.error(f"Error fetching next review cards: {e}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, "An internal error occurred while fetching review cards.")


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