import logging
import grpc
from google.protobuf.struct_pb2 import Struct

# Import generated types
from generated import conscious_api_pb2
from generated import conscious_api_pb2_grpc

# Import config data source
from data.sources import define_sources # Assuming this defines the structure

logger = logging.getLogger(__name__)

class ConfigServiceServicer(conscious_api_pb2_grpc.ConfigServiceServicer):
    """Implements the ConfigService RPCs."""

    def GetConfigs(self, request: conscious_api_pb2.GetConfigsRequest,
                   context: grpc.ServicerContext) -> conscious_api_pb2.GetConfigsResponse:
        """
        Handles the GetConfigs RPC.
        Returns configurations based on the requested type.
        """
        config_type = request.config_type
        logger.info(f"Received GetConfigs request for type: {config_type}")

        supported = ['sources'] # Match FastAPI logic

        if config_type not in supported:
            logger.warning(f"Config type '{config_type}' not found.")
            context.abort(grpc.StatusCode.NOT_FOUND, f"No config found for: {config_type}")
            # return conscious_api_pb2.GetConfigsResponse() # Unreachable

        try:
            if config_type == 'sources':
                config_data = define_sources
            else:
                # Should not happen due to check above, but defensively code
                 context.abort(grpc.StatusCode.INTERNAL, "Unsupported configuration type requested after validation.")
                 # return conscious_api_pb2.GetConfigsResponse() # Unreachable


            # Convert the Python dict to a Protobuf Struct
            response_struct = Struct()
            response_struct.update(config_data) # Directly update Struct from dict

            logger.info(f"Returning configs for type: {config_type}")
            return conscious_api_pb2.GetConfigsResponse(configs=response_struct)

        except Exception as e:
            logger.error(f"Error processing GetConfigs request for {config_type}: {e}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, "An internal error occurred while retrieving configurations.")
            # return conscious_api_pb2.GetConfigsResponse() # Unreachable