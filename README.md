# The Soul

The bitemporal, graph-backed intelligent agent system.

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (v1.1+)
- [Docker](https://www.docker.com/) & Docker Compose

### Setup

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Start Infrastructure (Databases)**
   ```bash
   bun run infra:up
   ```
   This spins up Redpanda, FalkorDB, and Qdrant in Docker.

3. **Start Services (Dev Mode)**
   ```bash
   bun run dev
   ```
   This runs the apps in parallel using Turborepo.

### Commands

- `bun run infra:up`: Start local DBs.
- `bun run infra:down`: Stop local DBs.
- `bun run build`: Build all apps and packages.
- `bun run test`: Run tests.
- `bun run lint`: Lint code.
