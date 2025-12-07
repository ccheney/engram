# Stage 1: Builder
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb turbo.json ./
COPY apps/ingestion ./apps/ingestion
COPY packages ./packages
# Install dependencies (including dev for build steps)
RUN bun install --frozen-lockfile
# Build the application
RUN bun run build --filter=ingestion-service...

# Stage 2: Runner
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -S soul && adduser -S soul -G soul

COPY --from=builder /app/apps/ingestion/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/ingestion/package.json ./

USER soul
EXPOSE 8080

CMD ["bun", "run", "dist/index.js"]
