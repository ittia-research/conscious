from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ReviewGradeSubmission(BaseModel):
    grade: int # FSRS uses 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)

class ReviewCardResponse(BaseModel):
    thought_id: int
    text: str
    # Add any other thought fields to display
    # Don't necessarily need to expose SRS state to frontend unless debugging
    class Config:
        orm_mode = True # For easy conversion from ORM objects
        
class ReviewUpdateResponse(BaseModel):
    message: str
    next_due: Optional[datetime] # Maybe return when it's next due
    state: Optional[str]         # Or the new state name

# Add a response model for discard
class DiscardResponse(BaseModel):
    message: str
    id: int
    