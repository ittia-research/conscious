from google.protobuf.struct_pb2 import Struct

# Import generated types
from generated import conscious_api_pb2
from generated import conscious_api_pb2_grpc

from data.sources import define_sources
from data.tasks import define_tasks


class ConfigServiceServicer(conscious_api_pb2_grpc.ConfigServiceServicer):
    """Implements the ConfigService RPCs."""

    def GetConfigs(self, request, context) -> conscious_api_pb2.GetConfigsResponse:
        """
        Get configs of sources, tasks.
        """

        # Convert the Python dict to a Protobuf Struct
        sources = Struct()
        sources.update(define_sources) # Directly update Struct from dict

        tasks = Struct()
        tasks.update(define_tasks)

        return conscious_api_pb2.GetConfigsResponse(
            sources=sources,
            tasks=tasks
            )
