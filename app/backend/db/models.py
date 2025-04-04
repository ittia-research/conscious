import uuid
from sqlalchemy import Column, BigInteger, String, Text, TIMESTAMP, func
from sqlalchemy_utils import UUIDType
from pgvector.sqlalchemy import VECTOR

from .session import Base
from core.config import settings


class Thoughts(Base):
    __tablename__ = "thoughts"
    thought_id = Column(BigInteger, primary_key=True)
    text = Column(Text, nullable=False)
    embedding = Column(VECTOR(settings.VECTOR_DIMENSION), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    def __repr__(self):
        _limit = 50
        preview = self.text[:_limit] + "..." if len(self.text) > _limit else self.text
        return f"<Thoughts(id={self.thought_id}, text='{preview}')>"
