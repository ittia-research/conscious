# SvelteKit frontend for production

ARG NODE_MAJOR=23


# Stage 1: Build the SvelteKit application
FROM node:${NODE_MAJOR}-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for build)
# Using 'ci' ensures a clean, reproducible install based on lockfile
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Generates the production-ready code (usually in /app/build)
RUN npm run build

# Optional: Prune development dependencies after build to reduce node_modules size
# This step removes packages listed in devDependencies from node_modules
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