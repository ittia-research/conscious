# interceptors/logging_timing.py

import time
import logging
import grpc
from typing import Any, Callable

# Import status and error detail types
from google.rpc import status_pb2, code_pb2
from google.rpc import error_details_pb2
from google.protobuf import any_pb2

logger = logging.getLogger(__name__)

# Helper to create a google.rpc.Status object
def create_status_proto(code: int, message: str, details: list = None) -> status_pb2.Status:
    status_proto = status_pb2.Status(code=code, message=message)
    if details:
        for detail in details:
            any_detail = any_pb2.Any()
            any_detail.Pack(detail)
            status_proto.details.append(any_detail)
    return status_proto

class LoggingTimingInterceptor(grpc.ServerInterceptor):
    """
    gRPC interceptor for logging, timing, and handling exceptions
    with richer google.rpc.Status details.
    """

    def intercept_service(self, continuation: Callable[[grpc.HandlerCallDetails], grpc.RpcMethodHandler],
                          handler_call_details: grpc.HandlerCallDetails) -> grpc.RpcMethodHandler:
        method_name = handler_call_details.method
        start_time = time.perf_counter()

        def wrapper(request: Any, context: grpc.ServicerContext) -> Any:
            peer = context.peer()
            logger.info(f"RPC Start: {method_name} from {peer}")

            try:
                # Proceed with the actual RPC method execution
                response = continuation(handler_call_details).unary_unary(request, context) # Adjust for streaming

                # Check if context was aborted by the servicer logic *before* returning
                # This can happen if the servicer calls context.abort()
                if not context.is_active():
                    # If aborted, gRPC framework handles sending the status. Log it here.
                    process_time = time.perf_counter() - start_time
                    # Note: context.details() and context.code() might require specific setup or
                    # might not be reliable immediately after user abort. Logging the fact is key.
                    logger.warning(
                        f"RPC Aborted by Servicer: {method_name} - Duration {process_time:.4f}s"
                        f" - Code: {context.code()} Details: '{context.details()}'" # Log reported status
                    )
                    # Response might be None or invalid if aborted, let gRPC handle it.
                    return response # Or potentially None, depending on handler expectations

                process_time = time.perf_counter() - start_time
                logger.info(f"RPC Success: {method_name} - Completed in {process_time:.4f}s")
                return response

            except Exception as e:
                process_time = time.perf_counter() - start_time
                logger.error(
                    f"RPC Unhandled Exception: {method_name} - Failed in {process_time:.4f}s. Error: {type(e).__name__}: {e}",
                    exc_info=True # Include stack trace for server logs
                )

                # Check if context already aborted (less likely here, but possible race)
                if not context.is_active():
                    logger.error(f"Context was already inactive during exception handling for {method_name}")
                    raise # Let gRPC handle the already aborted state

                # --- Richer Error Handling ---
                # Create a standard ErrorInfo detail
                error_info = error_details_pb2.ErrorInfo(
                    reason=f"UNHANDLED_EXCEPTION_{type(e).__name__.upper()}",
                    domain="conscious.api.grpc", # Your service domain
                    metadata={"method": method_name}
                )
                # Create the main status proto
                status_proto = create_status_proto(
                    code=code_pb2.INTERNAL, # Map exception to gRPC code
                    message="An unexpected internal error occurred.", # User-friendly message
                    details=[error_info] # Attach structured details
                )

                # Set the rich status details before aborting
                # Trailing metadata is the standard way to send google.rpc.Status
                context.set_trailing_metadata((('grpc-status-details-bin', status_proto.SerializeToString()),))

                # Abort with the basic code and message (clients relying solely on this still get info)
                context.abort(
                    code=grpc.StatusCode.INTERNAL,
                    details="An unexpected internal error occurred."
                )
                # Raising after abort might not be strictly necessary as abort signals gRPC,
                # but ensures the Python execution flow stops here.
                raise e


        original_handler = continuation(handler_call_details)
        # Ensure this matches the type of RPC (unary_unary, unary_stream, etc.)
        if original_handler.unary_unary:
             return grpc.unary_unary_rpc_method_handler(
                wrapper,
                request_deserializer=original_handler.request_deserializer,
                response_serializer=original_handler.response_serializer,
            )
        # Add similar blocks for unary_stream, stream_unary, stream_stream if needed
        else:
             # Fallback or raise error if handler type is unexpected/unsupported
             logger.error(f"Unsupported RPC type for method {method_name} in interceptor.")
             # Return the original handler to avoid breaking the call, but log error
             return original_handler