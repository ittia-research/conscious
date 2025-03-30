import logging
import time

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

# Using an aggregated router in api.v1.api
from api.v1.api import api_router as api_router_v1

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Conscious API",
    description="Backend API.",
    version="0.1.0",
)

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    logger.info(f"{request.method} {request.url.path} - Completed in {process_time:.4f}s")
    return response

# --- Routers ---
app.include_router(api_router_v1, prefix="/v1") # Prefix all v1 routes

# --- Root Endpoint ---
@app.get("/", tags=["Root"])
async def read_root():
    """Basic health check endpoint."""
    return {"message": "Hello"}

# --- Optional: Global Exception Handlers ---
# Example: Custom handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log the detailed error
    logger.error(f"Validation error for {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

# Example: Generic exception handler (catch-all)
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception for {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred."},
    )
