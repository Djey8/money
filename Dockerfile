
# Stage 1: Build Angular application
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f as build

# Create working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Configure npm for better reliability and install dependencies
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build Angular application for self-hosted deployment
RUN npm run build:selfhosted

# Stage 2: Serve with nginx
FROM docker.io/library/nginx:alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de

# Patch known CVEs in Alpine system packages
RUN apk upgrade --no-cache libcrypto3 libssl3 libpng musl musl-utils zlib

# Copy custom nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf

# Copy built Angular app from build stage
COPY --from=build /app/dist/money /usr/share/nginx/html

# Expose ports
EXPOSE 8080 8443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
