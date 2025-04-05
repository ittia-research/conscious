"""
py-fsrs settings with default:
  parameters
  desired_retention
  enable_fuzzing
  learning_steps
  relearning_steps
  maximum_interval

Goals:
  - Collect ReviewLog objects, in order to compute an optimal set of parameters.

TO-DO: FSRS optimize with probably fsrs-rs-python
"""
import logging
from datetime import datetime, timezone
from fsrs import Scheduler, Card, Rating

from db.models import Thoughts, ReviewLogs


logger = logging.getLogger(__name__)


def review_card(thought: Thoughts, rating: int, discard: bool = False) -> tuple[Thoughts, ReviewLogs]:
    """
    Receive current thought and review data, return thought and review_logs after review.
    Skip review and update discard if set True.
    """
    review_logs = ReviewLogs(
        thought_id = thought.thought_id,
        rating = rating,
        stability_before = thought.srs_stability,
        difficulty_before = thought.srs_difficulty,
        state_before = thought.srs_state,
        step_before = thought.srs_step,
        last_review = thought.srs_last_review,
        due_before = thought.srs_due,
    )

    # Skip review if discard
    if discard is True:
        review_logs.time = datetime.now(timezone.utc)
        review_logs.rating = 0  # 0 for not available when card set to discard
        review_logs.discard = discard

        thought.srs_discard = discard
        logger.info(f"Review discard received, thought ID {thought.thought_id}, update table")
        return thought, review_logs

    # Reviewing card
    scheduler = Scheduler()
    _card_params = {
        'card_id': thought.thought_id,
        'step': thought.srs_step,
        'stability': thought.srs_stability,
        'difficulty': thought.srs_stability,
        'due': thought.srs_due,
        'last_review': thought.srs_last_review
    }
    if thought.srs_state: # state in Card() default not None
        _card_params['state'] = thought.srs_state
    card = Card( **_card_params )
        
    logger.debug(f"Card before review: {card}")
    card, log = scheduler.review_card(
        card = card,
        rating = Rating(rating),
        review_datetime = None,  # TO-DO
        review_duration = None,  # TO-DO
    )

    # Update thought and review_log after review
    thought.srs_rating = rating
    thought.srs_stability = card.stability
    thought.srs_difficulty = card.difficulty
    thought.srs_state = card.state
    thought.srs_step = card.step
    thought.srs_last_review = log.review_datetime
    thought.srs_due = card.due

    review_logs.time = log.review_datetime
    review_logs.stability_after = card.stability
    review_logs.difficulty_after = card.difficulty
    review_logs.state_after = card.state
    review_logs.step_after = card.step
    review_logs.due_after = card.due

    logger.debug(f"Card after review: {card}")
    logger.debug(f"Review logs: {review_logs}")

    return thought, review_logs
