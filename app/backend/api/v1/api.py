from fastapi import APIRouter

# Import individual endpoint routers
from .endpoints import find, configs, review

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(find.router, prefix="/find", tags=[])
api_router.include_router(configs.router, prefix="/configs", tags=["config"])
api_router.include_router(review.router, prefix="/review", tags=["review"])
