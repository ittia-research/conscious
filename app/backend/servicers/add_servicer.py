import grpc
import logging

from generated import conscious_api_pb2 as pb2
from generated import conscious_api_pb2_grpc as pb2_grpc

from modules.add_data import AddData

class DataServiceServicer(pb2_grpc.DataServiceServicer):
    def AddData(self, request: pb2.AddDataRequest, context) -> pb2.AddDataResponse:
        """Handles the AddData RPC call."""

        try:
            # Extract data
            task = request.task
            source_type = request.source_type
            # Protobuf map is already dict-like, but explicit conversion is safe
            source_identifiers = dict(request.source_identifiers)

            # Handle optional file content (bytes)
            file_bytes = None
            if request.HasField('file_content'): # Check presence for optional field
                file_bytes = request.file_content
                if not file_bytes:
                    file_bytes = None

            # TO-DO: is this needed
            text_list = list(request.text_list) if request.text_list else None

            AddData(
                task=task,
                source_type=source_type,
                source_identifiers=source_identifiers,
                file_content=file_bytes,
                text_list=text_list
            ).run()

            logging.info("AddData processed successfully.")
            return pb2.AddDataResponse(success=True, message="Data added successfully.")

        except Exception as e:
            logging.error(f"Error processing AddData request: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL) 
            context.set_details(f"An internal error occurred: {e}")
            return pb2.AddDataResponse(success=False, message=f"Failed to add data: {e}")
