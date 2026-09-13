# MCP server Dockerfile (Streamable HTTP transport + OAuth — docs/adr/0008)
#
# Build context must be the REPO ROOT, not apps/mcp/ — this Dockerfile needs
# docs/api/openapi.yaml (schema generation, see scripts/generate-operations.ts)
# and docs/domain/ (explain_concept's content, loaded at runtime) visible in
# the build context:
#   docker build -f apps/mcp/Dockerfile -t money-mcp:latest .
# (.dockerignore's blanket `docs`/`*.md` excludes are punched through for
# exactly these two paths — see its own comment before assuming either is
# missing from the context.)
#
# The runtime image deliberately mirrors the repo's apps/mcp + docs sibling
# layout (WORKDIR /repo/apps/mcp, with /repo/docs/domain alongside it)
# instead of a flattened /app layout: apps/mcp/src/tools/explain.ts resolves
# docs/domain/ at runtime via a path climbed relative to dist/tools/explain.js
# (4 levels up to the repo root) — flattening the layout would silently
# break explain_concept (it degrades to zero topics rather than crashing,
# so this is easy to miss and easy to get wrong).

FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/mcp/package.json apps/mcp/package.json
RUN npm ci --workspace=apps/mcp --include-workspace-root=false --legacy-peer-deps --ignore-scripts
COPY apps/mcp apps/mcp
COPY docs/api/openapi.yaml docs/api/openapi.yaml
RUN npm run build --workspace=apps/mcp

# Runtime image
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f

RUN apk upgrade --no-cache libcrypto3 libssl3 musl musl-utils zlib

# npm ci (not npm install) against the real root package-lock.json, same as
# the build stage — apps/mcp has no lockfile of its own, and installing here
# without one would silently re-resolve dependency versions instead of using
# the exact ones npm run verify's tests actually ran against.
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/mcp/package.json apps/mcp/package.json
RUN npm config set fetch-timeout 600000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --workspace=apps/mcp --include-workspace-root=false --omit=dev --legacy-peer-deps --ignore-scripts

COPY --from=build /repo/apps/mcp/dist apps/mcp/dist
COPY docs/domain docs/domain

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /repo

USER nodejs

WORKDIR /repo/apps/mcp
ENV MM_MCP_TRANSPORT=http
EXPOSE 3939

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3939/.well-known/oauth-authorization-server', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
