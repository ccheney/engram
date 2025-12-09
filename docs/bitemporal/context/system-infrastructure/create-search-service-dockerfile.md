# Bead: Create Search Service Dockerfile

## Context
The **Search Service** calculates embeddings and talks to Qdrant. It may require Python for heavy ML lifting, OR we use a remote Embedding API (OpenAI/Voyage).
*Assumption*: We use a Node service that calls an external Embedding API or a sidecar. If local embeddings are required (e.g., `transformers.js` or ONNX), image size increases.
*Decision*: Keep it lightweight TS/Node calling external APIs for now.

## Goal
Create a `Dockerfile` for the Search Service.

## Specifications
-   **Base Image**: `node:24-alpine`.
-   **Ports**: Expose `8080`.

## Dockerfile

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --filter=search...

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S soul && adduser -S soul -G soul

COPY --from=builder /app/apps/search/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

USER soul
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

## Acceptance Criteria
-   [ ] Dockerfile builds successfully.
-   [ ] ONNX Runtime (if added later) functionality is verified.
