# Backend Dockerfile
#
# Build context must be the REPO ROOT, not backend/ — this Dockerfile builds
# packages/domain (a workspace member backend/package.json depends on via
# "@money/domain": "file:../packages/domain") from source in its own stage,
# which needs packages/domain/ to be visible in the build context:
#   docker build -f backend/Dockerfile -t money-backend:latest .
# (docker-compose.yml, docker-compose.e2e.yml, scripts/deploy.sh, and
# scripts/deploy-local.ps1 are all wired this way already.)

# Stage 1: build the shared domain package from source, using the real root
# package-lock.json (via `npm ci --workspace`) so the exact dependency
# versions npm run verify's domain tests actually ran against — crypto-js in
# particular, a production dependency of this shared encryption/money logic —
# are what ships, not whatever a lockfile-less `npm install` happens to
# re-resolve at build time. `--ignore-scripts` skips root's own `prepare`
# (husky) lifecycle script, irrelevant and broken in this scriptless,
# .git-less build context; this stage never needs it.
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS domain-build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/tsconfig.json packages/domain/
RUN npm ci --workspace=packages/domain --include-workspace-root=false --legacy-peer-deps --ignore-scripts
COPY packages/domain/src packages/domain/src
RUN npm run build --workspace=packages/domain
# npm hoists packages/domain's resolved deps to /repo/node_modules, not
# packages/domain/node_modules — relocate just the one runtime dependency
# (crypto-js; everything else installed here is dev-only build tooling like
# typescript/jest, never shipped) to a stable, predictable path for Stage 2's
# COPY --from to target.
RUN mkdir -p packages/domain/node_modules && \
    cp -r node_modules/crypto-js packages/domain/node_modules/crypto-js

# Stage 2: backend runtime image
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f

# Patch known CVEs in Alpine system packages
RUN apk upgrade --no-cache libcrypto3 libssl3 musl musl-utils zlib

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Configure npm for better reliability and install dependencies
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi

# The running container only ever executes `node server.js` — npm (and its
# own bundled dependency tree, which ships CVEs of its own, independent of
# anything this app depends on) is never invoked at runtime. Removing it
# here, once the production install above is done with it, fixes those
# findings at the source instead of patching individual nested npm
# dependencies one CVE at a time as new ones surface (mm-admin is run
# against the deployed CouchDB endpoint from a developer machine with the
# repo checked out, not from inside this container — no npm needed here).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Copy application files
COPY backend/ .

# package.json's "@money/domain": "file:../packages/domain" resolves (once npm
# ci above creates node_modules/@money/domain as a symlink to
# ../../../packages/domain) to /packages/domain from this WORKDIR — populate
# it from Stage 1's build output.
COPY --from=domain-build /repo/packages/domain/dist /packages/domain/dist
COPY --from=domain-build /repo/packages/domain/package.json /packages/domain/package.json
COPY --from=domain-build /repo/packages/domain/node_modules /packages/domain/node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /packages

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
