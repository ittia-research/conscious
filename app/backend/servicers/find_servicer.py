# servicers/find_servicer.py

import logging
import grpc
from typing import Dict

# Import generated types
from generated import conscious_api_pb2
from generated import conscious_api_pb2_grpc

# Import business logic and utilities
from modules.find_thoughts import FindThoughts
from utils.validators import decode_unicode_escapes_logic

# Import status types for richer errors
from google.rpc import status_pb2, code_pb2
from google.rpc import error_details_pb2
from google.protobuf import any_pb2
from interceptors.logging_timing import create_status_proto # Import helper

logger = logging.getLogger(__name__)

class FindServiceServicer(conscious_api_pb2_grpc.FindServiceServicer):
    """Implements the FindService RPCs."""

    def FindThoughts(self, request: conscious_api_pb2.FindThoughtsRequest,
                     context: grpc.ServicerContext) -> conscious_api_pb2.FindThoughtsResponse:

        logger.info(f"Received FindThoughts request: type={request.type}, identifiers={request.identifiers}")

        validation_errors = []
        try:
            # --- Input Validation with Rich Error Details ---
            text = decode_unicode_escapes_logic(request.text).strip()
            type_str = request.type
            identifiers_dict: Dict[str, str] = dict(request.identifiers)

            if not text:
                validation_errors.append(
                    ("text", "Input text cannot be empty after decoding and stripping.")
                )
            if not type_str:
                validation_errors.append(("type", "Type cannot be empty."))
            if not identifiers_dict:
                 validation_errors.append(("identifiers", "Identifiers map cannot be empty."))

            # If validation errors exist, abort with BadRequest details
            if validation_errors:
                logger.warning(f"Validation failed for FindThoughts: {validation_errors}")
                bad_request_details = error_details_pb2.BadRequest(
                    field_violations=[
                        error_details_pb2.BadRequest.FieldViolation(field=field, description=desc)
                        for field, desc in validation_errors
                    ]
                )
                status_proto = create_status_proto(
                    code=code_pb2.INVALID_ARGUMENT,
                    message="Invalid request parameters.",
                    details=[bad_request_details]
                )
                context.set_trailing_metadata((('grpc-status-details-bin', status_proto.SerializeToString()),))
                context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Invalid request parameters.")
                # return conscious_api_pb2.FindThoughtsResponse() # Unreachable

            # Add type to identifiers (matching FastAPI logic)
            identifiers_dict['type'] = type_str

            # --- Cancellation Check Point (Example) ---
            # If FindThoughts service call could be long:
            # if not context.is_active():
            #     logger.info("Client cancelled FindThoughts request before processing.")
            #     context.abort(grpc.StatusCode.CANCELLED, "Request cancelled by client.")
            #     return conscious_api_pb2.FindThoughtsResponse()

            logger.debug(f"Processing find request for {identifiers_dict} -> text: {text[:100]}...")

            # --- Business Logic ---
            find_thoughts_service = FindThoughts(text=text, identifiers=identifiers_dict)
            thoughts = find_thoughts_service.find() # Assume this can raise its own exceptions

            logger.info(f"Found {len(thoughts)} thoughts for {identifiers_dict}")
            return conscious_api_pb2.FindThoughtsResponse(thoughts=thoughts)

        # --- Specific Business Logic Exception Handling (Example) ---
        # except SomeCustomBusinessError as e:
        #     logger.error(f"Business logic error in FindThoughts: {e}", exc_info=True)
        #     # Create appropriate status proto (e.g., FAILED_PRECONDITION)
        #     status_proto = create_status_proto(code=code_pb2.FAILED_PRECONDITION, message=str(e))
        #     context.set_trailing_metadata((('grpc-status-details-bin', status_proto.SerializeToString()),))
        #     context.abort(grpc.StatusCode.FAILED_PRECONDITION, str(e))
        #     return conscious_api_pb2.FindThoughtsResponse()

        except Exception as e:
            # Let the interceptor handle truly unexpected errors
            logger.error(f"Unhandled exception in FindThoughts servicer: {e}", exc_info=True)
            # Re-raise for the interceptor to catch and format as INTERNAL error
            raise