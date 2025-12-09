# Bead: Create Memory Service Dockerfile

## Context
The **Memory Service** interacts with FalkorDB and Redpanda. It requires robust error handling and potentially native bindings for Redis clients.

## Goal
Create a `Dockerfile` for the Memory Service.

## Specifications
-   **Base Image**: `node:24-alpine`
-   **Ports**: Expose `8080`.

## Dockerfile

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --filter=memory...

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S soul && adduser -S soul -G soul

COPY --from=builder /app/apps/memory/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

USER soul
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

## Acceptance Criteria
-   [ ] Dockerfile builds successfully.
-   [ ] Native dependencies for Redis/FalkorDB client (if any) are correctly linked.
-   [ ] Container passes local smoke test.
