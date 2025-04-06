# Stage 1: Builder
# Use a specific Python version matching your development environment
FROM python:3.11-slim-bookworm AS builder

# Set working directory
WORKDIR /app

# Install build dependencies (including grpcio-tools) and OS packages if needed
# Use --no-cache-dir to reduce layer size
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir grpcio-tools

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies (without grpcio-tools if not needed at runtime)
# Using virtualenv within the stage to isolate dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# Copy protobuf definitions
COPY protos /app/protos

# Create output directory for generated code
RUN mkdir /app/generated

# Generate protobuf code
# protoc should find google includes automatically via installed grpcio/googleapis packages
RUN python -m grpc_tools.protoc \
    -I./protos \
    --python_out=./generated \
    --pyi_out=./generated \
    --grpc_python_out=./generated \
    protos/conscious_api.proto

# Create __init__.py files to make generated code importable
# TO-DO: need in sub-dir also?
RUN touch generated/__init__.py

# Stage 2: Final Production Image
FROM python:3.11-slim-bookworm

# Set working directory
WORKDIR /app

# # Create a non-root user and group
# RUN groupadd --system app && useradd --system --gid app app

# Copy installed dependencies from builder stage's virtualenv
COPY --from=builder /opt/venv /opt/venv

# Copy generated protobuf code from builder stage
COPY --from=builder /app/generated /app/generated

# Copy application code (excluding protos, requirements.txt etc. already handled)
COPY . /app

# Ensure scripts are executable if needed (e.g., entrypoint scripts)
# RUN chmod +x /app/entrypoint.sh

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH"
# Ensure logs aren't buffered by Python
ENV PYTHONUNBUFFERED=1
ENV GRPC_PORT=50051

# TO-DO: any better way
ENV PYTHONPATH=/app/generated
        
# # Switch to non-root user
# USER app

# Expose the gRPC port
EXPOSE ${GRPC_PORT}

# Define the command to run the application
# Use python -u for unbuffered output, critical for container logging
CMD ["python", "-u", "server.py"]