# server.py

import logging
import grpc
from concurrent import futures
import signal
import sys
import os # For environment variables
import threading

# Import generated modules and servicers
from generated import conscious_api_pb2_grpc
from servicers.find_servicer import FindServiceServicer
from servicers.config_servicer import ConfigServiceServicer
from servicers.review_servicer import ReviewServiceServicer
from servicers.health_servicer import HealthServicer

# Import interceptors
from interceptors.logging_timing import LoggingTimingInterceptor

from core.config import settings

# Import core settings or load from environment
# from core.config import settings -> Adapt as needed
GRPC_PORT = int(os.environ.get("GRPC_PORT", 50051))

# --- Logging Configuration ---
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout # Log to stdout for container environments
)
# Disable excessive logging from libraries if needed
# logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# --- Global Server Instance ---
_server = None
_stop_event = threading.Event() # Use an event for signaling shutdown

# --- Graceful Shutdown Handler ---
def _handle_sigterm(signum, frame):
    logger.info(f"Received signal {signum}. Initiating graceful shutdown...")
    _stop_event.set() # Signal the main loop to stop
    if _server:
        # Grace period (e.g., 30 seconds) to allow ongoing requests to complete
        shutdown_result = _server.stop(30)
        shutdown_result.wait() # Wait for shutdown to complete
        logger.info("gRPC server stopped.")
    sys.exit(0)


# --- Server Function ---
def serve():
    global _server

    # Register signal handlers
    signal.signal(signal.SIGTERM, _handle_sigterm)
    signal.signal(signal.SIGINT, _handle_sigterm)

    interceptors = [LoggingTimingInterceptor()]

    # --- Keepalive Options ---
    # These values are examples; tune them based on your network environment
    # and load balancer settings.
    server_options = [
        # Send keepalive ping every 60 seconds if no activity
        ('grpc.keepalive_time_ms', 60000),
        # Allow client keepalive pings even with no calls ongoing
        ('grpc.keepalive_permit_without_calls', 1),
        # Close connection if keepalive ping not acknowledged within 20 seconds
        ('grpc.http2.max_ping_strikes', 2), # Equivalent concept: close after N failed pings
        ('grpc.keepalive_timeout_ms', 20000),
         # Maximum number of pings allowed when no streams are active
        ('grpc.http2.max_pings_without_data', 5),
    ]

    _server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=int(os.environ.get("GRPC_MAX_WORKERS", 10))),
        interceptors=interceptors,
        options=server_options # Add keepalive options
    )

    # Register servicers
    conscious_api_pb2_grpc.add_FindServiceServicer_to_server(FindServiceServicer(), _server)
    conscious_api_pb2_grpc.add_ConfigServiceServicer_to_server(ConfigServiceServicer(), _server)
    conscious_api_pb2_grpc.add_ReviewServiceServicer_to_server(ReviewServiceServicer(), _server)
    conscious_api_pb2_grpc.add_HealthServicer_to_server(HealthServicer(), _server)

    listen_addr = f'[::]:{GRPC_PORT}'

    # --- Security ---
    # !! FOR PRODUCTION: Use add_secure_port !!
    # Example (replace with your actual cert/key loading):
    # try:
    #     with open('path/to/server.key', 'rb') as f:
    #         private_key = f.read()
    #     with open('path/to/server.crt', 'rb') as f:
    #         certificate_chain = f.read()
    #     server_credentials = grpc.ssl_server_credentials(
    #         ((private_key, certificate_chain),)
    #     )
    #     _server.add_secure_port(listen_addr, server_credentials)
    #     logger.info(f"Starting SECURE gRPC server on {listen_addr}")
    # except FileNotFoundError:
    #      logger.error("SSL Cert/Key not found. Cannot start secure server.")
    #      sys.exit(1)

    # For development/testing without TLS:
    _server.add_insecure_port(listen_addr)
    logger.warning(f"Starting INSECURE gRPC server on {listen_addr}. Use secure port in production.")


    _server.start()
    logger.info(f"gRPC Server started successfully on port {GRPC_PORT}. Waiting for termination signal...")

    # Keep the main thread alive until shutdown signal
    _stop_event.wait()

    logger.info("Shutdown signal received. Server stop initiated earlier.")


if __name__ == '__main__':
    # --- Database Initialization/Checks ---
    # Optional: Add a check here to ensure DB connection works before starting server fully
    # try:
    #     with get_db_session() as db:
    #         db.execute(text("SELECT 1")) # Simple query to check connection
    #     logger.info("Database connection successful.")
    # except Exception as e:
    #     logger.error(f"Database connection failed: {e}", exc_info=True)
    #     sys.exit(1)

    serve()