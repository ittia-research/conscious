import uuid
from sqlalchemy import Column, BigInteger, String, Text, TIMESTAMP, func
from sqlalchemy_utils import UUIDType
from pgvector.sqlalchemy import VECTOR

from .session import Base
from core.config import settings

class Sources(Base):
    __tablename__ = "sources"
    source_id = Column(BigInteger, primary_key=True)
    source_type = Column(String(50), nullable=False)
    identifier = Column(Text, nullable=False)
    guid = Column(UUIDType(binary=False), unique=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Sources(id={self.source_id}, type='{self.source_type}', guid='{self.guid}')>"

class Thoughts(Base):
    __tablename__ = "thoughts"
    thought_id = Column(BigInteger, primary_key=True)
    content = Column(Text, nullable=False)
    embedding = Column(VECTOR(settings.VECTOR_DIMENSION), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    def __repr__(self):
        _limit = 50
        preview = self.content[:_limit] + "..." if len(self.content) > _limit else self.content
        return f"<Thoughts(id={self.thought_id}, content='{preview}')>"
