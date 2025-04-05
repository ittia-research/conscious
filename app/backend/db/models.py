import enum
from sqlalchemy import (Column, Integer, BigInteger, Boolean, DateTime, 
                        Float, Text, func, SmallInteger, PrimaryKeyConstraint)
from sqlalchemy.dialects.postgresql import REAL, TIMESTAMP # Use specific PG types
from pgvector.sqlalchemy import VECTOR
from fsrs import State as FSRSState

from .session import Base
from core.config import settings


# TO-DO: is it a good practice to use FSRSState value in database level directly?
class Thoughts(Base):
    __tablename__ = "thoughts"
    thought_id = Column(BigInteger, primary_key=True)
    text = Column(Text, nullable=False)
    embedding = Column(VECTOR(settings.VECTOR_DIMENSION), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # SRS Fields
    srs_due = Column(DateTime(timezone=True), index=True)
    srs_stability = Column(Float)
    srs_difficulty = Column(Float)
    srs_state = Column(SmallInteger)
    srs_rating = Column(SmallInteger)
    srs_step = Column(SmallInteger)
    srs_last_review = Column(DateTime(timezone=True))
    srs_discard = Column(Boolean)

    # @property
    # def srs_state(self) -> FSRSState:
    #     """Gets the state as a FSRSState enum member."""
    #     if self._srs_state is None: # srs_state could be Null
    #         return self._srs_state
    #     return FSRSState(self._srs_state)

    # @srs_state.setter
    # def srs_state(self, value: FSRSState):
    #     """Sets the state using a TaskStatus enum member."""
    #     if not isinstance(value, FSRSState):
    #         raise TypeError(f"Expected TaskStatus enum member, got {type(value)}")
    #     self._srs_state = value.value # Store the integer value

    def __repr__(self):
        _limit = 50
        preview = self.text[:_limit] + "..." if len(self.text) > _limit else self.text
        return f"<Thoughts(id={self.thought_id}, text='{preview}')>"


class ReviewLogs(Base):
    """
    TimescaleDB table for review logs.
    """
    __tablename__ = 'review_logs'

    # log_id = Column(Integer, primary_key=True) # TO-DO: remove this one

    time = Column(TIMESTAMP(timezone=True), nullable=False)
    thought_id = Column(Integer, nullable=False)
    rating = Column(SmallInteger, nullable=False)
    stability_before = Column(REAL)
    stability_after = Column(REAL)
    difficulty_before = Column(REAL)
    difficulty_after = Column(REAL)
    state_before = Column(SmallInteger)
    state_after = Column(SmallInteger)
    step_before = Column(SmallInteger)
    step_after = Column(SmallInteger)
    last_review = Column(TIMESTAMP(timezone=True))
    review_duration = Column(Integer)
    due_before = Column(TIMESTAMP(timezone=True))
    due_after = Column(TIMESTAMP(timezone=True))
    discard = Column(Boolean)

    # Define the composite primary key
    __table_args__ = (
        PrimaryKeyConstraint('time', 'thought_id', name='review_logs_pkey'),
    )