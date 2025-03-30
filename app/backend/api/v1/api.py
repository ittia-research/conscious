from fastapi import APIRouter

# Import individual endpoint routers
from .endpoints import find

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(find.router, prefix="/find", tags=["find"])
