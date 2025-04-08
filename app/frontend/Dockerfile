# SvelteKit frontend for production

# Build from context of `./app` instead of `./app/frontend` to use the shared protos folder

ARG NODE_MAJOR=23


# Stage 1: Build the SvelteKit application
FROM node:${NODE_MAJOR}-alpine AS builder

WORKDIR /app

# Install protobuf compiler and development headers for generate TypeScript proto
RUN apk add --no-cache protoc protobuf-dev

# Copy package manifests
COPY frontend/package.json frontend/package-lock.json* ./

# Install all dependencies (including devDependencies needed for build)
# Using 'ci' ensures a clean, reproducible install based on lockfile
RUN npm ci

# Copy the rest of the application source code
COPY frontend .

# Generate TypeScript proto files before build
COPY backend/protos src/protos
RUN mkdir -p ./src/lib/server/grpc/generated \
    && protoc \
    --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
    --ts_proto_out=./src/lib/server/grpc/generated \
    --ts_proto_opt=env=node,outputServices=grpc-js,useExactTypes=false \
    -I/usr/include \
    -I./src/protos \
    -I./src/lib/server/protos \
    ./src/protos/conscious_api.proto \
    ./src/lib/server/protos/gateway.proto 

# For env check during build
# TO-DO: better solution
ENV BACKEND_API_BASE="localhost:50051"
ENV BACKEND_API_KEY="PLACE_HOLDER"

# Generates the production-ready code (usually in /app/build)
RUN npm run build

# Prune development dependencies after build to reduce node_modules size
RUN npm prune --omit=dev


# Stage 2: Setup the production environment
FROM node:${NODE_MAJOR}-alpine AS runner

WORKDIR /app

# Set Node environment to production
# Many libraries optimize based on this flag
ENV NODE_ENV=production

# Copy only necessary files from the builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# adapter-node typically creates an entry point at build/index.js
# Running 'node build' executes this entry point.
CMD ["node", "build"]

# Set user for security (better than running as root)
USER node