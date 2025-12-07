FROM oven/bun:1 AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build --filter=memory-service...

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S soul && adduser -S soul -G soul

COPY --from=builder /app/apps/memory/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

USER soul
EXPOSE 8080
CMD ["bun", "run", "dist/index.js"]
