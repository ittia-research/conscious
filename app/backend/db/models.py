import enum
from sqlalchemy import Column, Integer, BigInteger, Boolean, DateTime, Float, Text, TIMESTAMP, func, Enum as SQLAlchemyEnum
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
    srs_lapses = Column(Integer, default=0)
    _srs_state = Column("srs_state", Integer)
    srs_last_review = Column(DateTime(timezone=True))
    srs_reps = Column(Integer, default=0)
    srs_discarded = Column(Boolean)

    @property
    def srs_state(self) -> FSRSState:
        """Gets the state as a FSRSState enum member."""
        if not self._srs_state: # srs_state could be Null
            return self._srs_state
        return FSRSState(self._srs_state)

    @srs_state.setter
    def srs_state(self, value: FSRSState):
        """Sets the state using a TaskStatus enum member."""
        if not isinstance(value, FSRSState):
            raise TypeError(f"Expected TaskStatus enum member, got {type(value)}")
        self._srs_state = value.value # Store the integer value

    def __repr__(self):
        _limit = 50
        preview = self.text[:_limit] + "..." if len(self.text) > _limit else self.text
        return f"<Thoughts(id={self.thought_id}, text='{preview}')>"
