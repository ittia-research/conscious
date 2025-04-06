import logging
import grpc
from generated import conscious_api_pb2
from generated import conscious_api_pb2_grpc

logger = logging.getLogger(__name__)

# Map service names to their respective check logic (if needed)
# For a simple case, we might just check overall server health.
SERVICE_MAP = {
    "": conscious_api_pb2.HealthCheckResponse.SERVING, # Overall health
    "conscious.v1.FindService": conscious_api_pb2.HealthCheckResponse.SERVING,
    "conscious.v1.ConfigService": conscious_api_pb2.HealthCheckResponse.SERVING,
    "conscious.v1.ReviewService": conscious_api_pb2.HealthCheckResponse.SERVING,
    # Add more specific checks if necessary, e.g., database connection
}

class HealthServicer(conscious_api_pb2_grpc.HealthServicer):
    """Implements the standard gRPC Health Checking Protocol."""

    def Check(self, request: conscious_api_pb2.HealthCheckRequest,
              context: grpc.ServicerContext) -> conscious_api_pb2.HealthCheckResponse:
        """Checks the health of the server or a specific service."""
        service = request.service
        status = SERVICE_MAP.get(service, conscious_api_pb2.HealthCheckResponse.SERVICE_UNKNOWN)

        if status == conscious_api_pb2.HealthCheckResponse.SERVICE_UNKNOWN:
             logger.warning(f"Health check requested for unknown service: '{service}'")
        # else:
             # logger.debug(f"Health check for '{service}': status {status}")


        # In a real scenario, you might add logic here to check dependencies
        # (e.g., database connection) and set status to NOT_SERVING if they fail.
        # For now, we assume it's serving if the service name is known.

        return conscious_api_pb2.HealthCheckResponse(status=status)

    # def Watch(self, request, context):
    #     # Optional: Implement streaming health updates if needed
    #     context.abort(grpc.StatusCode.UNIMPLEMENTED, "Watch method is not implemented")