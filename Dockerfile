
# Stage 1: Build Angular application
FROM node:22-alpine@sha256:1e8b5d68cac394f76c931b266fe5c224c3fe4cdbc33131e064c83b88235fe77e as build

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
FROM docker.io/library/nginx:alpine@sha256:7e89aa6cabfc80f566b1b77b981f4bb98413bd2d513ca9a30f63fe58b4af6903

# Copy custom nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf

# Copy built Angular app from build stage
COPY --from=build /app/dist/money /usr/share/nginx/html

# Expose ports
EXPOSE 8080 8443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
