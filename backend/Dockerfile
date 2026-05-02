# Backend Dockerfile
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f

# Patch known CVEs in Alpine system packages.
# Upgrade everything rather than chasing individual packages.
RUN apk upgrade --no-cache

# Patch picomatch ReDoS (CVE-2026-33671) in global npm
RUN cd /usr/local/lib/node_modules/npm/node_modules/picomatch && \
    npm pack picomatch@4.0.4 2>/dev/null && \
    tar xzf picomatch-4.0.4.tgz --strip-components=1 && \
    rm -f picomatch-4.0.4.tgz

WORKDIR /app

# Copy package files
COPY package*.json ./

# Configure npm for better reliability and install dependencies
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi

# Copy application files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
