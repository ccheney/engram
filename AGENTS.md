# Engram

A bitemporal, graph-backed intelligent agent system designed as a TypeScript monorepo.

## Project Structure

This project is a **Turborepo** monorepo managed with **npm**.

- **`apps/`**: Application services.
  - `control`: Likely the orchestration or management layer.
  - `execution`: Task or agent execution service.
  - `ingestion`: Data ingestion service.
  - `interface`: Frontend or API gateway.
  - `memory`: Memory management service (interacting with vector/graph DBs).
  - `search`: Search service.
- **`packages/`**: Shared libraries and core logic.
  - `events`, `execution-core`, `infra`, `ingestion-core`, `logger`, `memory-core`, `search-core`, `storage`, `tsconfig`, `vfs`.
- **`docker-compose.dev.yml`**: Defines the local development infrastructure.

## Infrastructure

The system relies on the following services (defined in `docker-compose.dev.yml`):
- **Redpanda**: Kafka-compatible event streaming (Ports: 18081, 9092).
- **FalkorDB**: Graph database (Port: 6379).
- **Qdrant**: Vector database (Port: 6333).

## Development Workflow

### Prerequisites
- **Node.js** (v24+)
- **npm** (v11+)
- **Docker** & **Docker Compose**

### Key Commands

| Command | Description |
| :--- | :--- |
| `npm install` | Install dependencies for all workspaces. |
| `npm run infra:up` | Start local infrastructure (Redpanda, FalkorDB, Qdrant). |
| `npm run infra:down` | Stop local infrastructure. |
| `npm run dev` | Start all applications in development mode (parallel). |
| `npm test` | Execute tests. |
| `npm run typecheck` | Run TypeScript type checking across the monorepo. |
| `npm run lint` | Run Biome linting. |
| `npm run format` | Run Biome formatting. |
| `npm run build` | Build all apps and packages. |

## Coding Standards

- **Formatter/Linter**: [Biome](https://biomejs.dev/) is used for both linting and formatting.
  - **Indentation**: Tabs.
  - **Quotes**: Double quotes.
  - **Line Width**: 100 characters.
  - **Imports**: Organized automatically.
- **Dependency Injection**: NestJS is likely used (inferred from `control`/`apps` structure common in backend TS), requiring careful handling of imports (avoid `import type` for DI tokens). *Verify per app.*
- **Package Manager**: Use `npm` for all package operations.

## Architecture Notes

- **Bitemporal**: The system likely handles two time dimensions (valid time and transaction time).
- **Graph-Backed**: FalkorDB is the primary graph store.
- **Vector Search**: Qdrant is used for semantic search/memory.
- **Event-Driven**: Redpanda is used for inter-service communication.

## Agent Mandates

- **Context7 MCP**: You **MUST** always use the Context7 MCP when working with a library.
- **Research First**: You **MUST** always perform web searches before working with a library to learn idiomatic patterns and view examples.

---
