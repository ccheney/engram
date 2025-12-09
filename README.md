# Engram

The bitemporal, graph-backed intelligent agent system.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v24+)
- [npm](https://www.npmjs.com/) (v11+)
- [Docker](https://www.docker.com/) & Docker Compose

### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Infrastructure (Databases)**
   ```bash
   npm run infra:up
   ```
   This spins up Redpanda, FalkorDB, and Qdrant in Docker.

3. **Start Services (Dev Mode)**
   ```bash
   npm run dev
   ```
   This runs the apps in parallel using Turborepo.

### Commands

- `npm run infra:up`: Start local DBs.
- `npm run infra:down`: Stop local DBs.
- `npm run build`: Build all apps and packages.
- `npm run test`: Run tests.
- `npm run lint`: Lint code.
