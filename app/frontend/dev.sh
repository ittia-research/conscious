#?/bin/sh

# Setup server for development and also save installation files to local for local IDE if mounted.

cd /app

# Install protobuf compiler and development headers for generate TypeScript proto
apk add --no-cache protoc protobuf-dev

# Install all dependencies including devDependencies
# Using 'ci' ensures a clean, reproducible install based on lockfile
npm ci

# Generate TypeScript proto files before build
# Remove existing first
find ./src/lib/server/grpc/generated -type f -delete

protoc \
    --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
    --ts_proto_out=./src/lib/server/grpc/generated \
    --ts_proto_opt=env=node,outputServices=grpc-js,useExactTypes=false \
    -I/usr/include \
    -I/data/protos \
    -I./src/lib/server/grpc/protos \
    /data/protos/conscious_api.proto \
    ./src/lib/server/grpc/protos/speak_gateway.proto

npx svelte-kit sync

# Start dev server
npm run dev -- --host --port 3000
