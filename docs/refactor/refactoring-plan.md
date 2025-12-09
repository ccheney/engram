# Comprehensive Refactoring Plan for Engram

**Generated**: 2025-12-09
**Scope**: Full monorepo - 6 apps, 9 packages
**Methodology**: Synergized analysis of 15 independent refactoring reports

---

## Executive Summary

This document consolidates 15 independent refactoring analyses into a unified, interoperable implementation plan. The goal is to ensure all changes work together cohesively without introducing conflicts or breaking cross-component interactions.

### Key Findings

| Category | Total Issues | High | Medium | Low |
|----------|-------------|------|--------|-----|
| Code Duplication (DRY) | 47 | 12 | 23 | 12 |
| Type Safety | 38 | 8 | 21 | 9 |
| SOLID Violations | 34 | 9 | 17 | 8 |
| Testing Gaps | 31 | 11 | 14 | 6 |
| Architecture | 28 | 8 | 15 | 5 |
| Error Handling | 22 | 5 | 12 | 5 |

### Critical Cross-Cutting Concerns

1. **Interface Abstractions**: 8 packages/apps depend on concrete `FalkorClient` without interface
2. **Configuration Systems**: 2 parallel config systems in `search-core` that must be unified
3. **Domain Type Definitions**: Types split between `memory-core`, `storage`, and apps
4. **Parser Registry**: Missing in `ingestion-core`, needed by `ingestion` app
5. **Logger Inconsistency**: Mix of `console.log` and `@engram/logger` across services

---

## Phase 0: Foundation (Prerequisites)

These changes must be completed first as other phases depend on them.

### 0.1 Create Unified Interface Layer in `@engram/storage`

**Why First**: 8 components depend on concrete `FalkorClient`. All DIP fixes depend on this.

**Changes**:
```typescript
// packages/storage/src/interfaces.ts (NEW FILE)

export interface GraphClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T>(cypher: string, params?: Record<string, unknown>): Promise<T[]>;
  isConnected(): boolean;
}

export interface MessageClient {
  getProducer(): Promise<Producer>;
  getConsumer(config: ConsumerConfig): Promise<Consumer>;
  disconnect(): Promise<void>;
}

export interface BlobStore {
  save(content: string | Buffer): Promise<string>;
  load(uri: string): Promise<string>;
}

// Already exists, ensure consistency
export interface RedisPublisher {
  publishSessionUpdate(sessionId: string, event: unknown): Promise<void>;
  disconnect(): Promise<void>;
}
```

**Dependent Components**:
- `apps/control` - ContextAssembler, SessionInitializer
- `apps/memory` - TurnAggregator, index.ts
- `apps/execution` - Rehydrator, TimeTravelService
- `apps/search` - SearchService
- `packages/memory-core` - GraphWriter, GraphMerger, GraphPruner
- `packages/search-core` - SearchRetriever, SearchIndexer

**Export from index.ts**:
```typescript
// packages/storage/src/index.ts
export * from "./interfaces";
export * from "./blob";
export * from "./falkor";
export * from "./kafka";
export * from "./redis"; // Currently missing!
```

---

### 0.2 Consolidate Domain Type Definitions

**Why First**: Types are scattered across 3 locations causing drift and circular dependencies.

**Current State**:
- `packages/storage/src/falkor.ts` - Contains domain types (SessionProperties, TurnProperties)
- `packages/memory-core/src/models/base.ts` - Re-exports with aliases (`FalkorSessionNode`)
- Various apps define their own `Session` interfaces

**Target State**:
```
packages/memory-core/src/
  models/
    base.ts           # Bitemporal types, BaseNode
    nodes.ts          # All node types (Session, Turn, Reasoning, ToolCall)
    edges.ts          # Edge types
    events.ts         # Event types (moved from @engram/events)
  index.ts            # Clean exports

packages/storage/src/
  falkor.ts           # Only FalkorDB-specific types (FalkorNode, FalkorEdge)
                      # No domain types - use memory-core
```

**Migration Steps**:
1. Move domain types from `storage/falkor.ts` to `memory-core/models/`
2. Update `storage/falkor.ts` to import from `memory-core` for domain types
3. Remove aliased re-exports from `memory-core/models/base.ts`
4. Update all consumers to import from `memory-core`

---

### 0.3 Create `@engram/common` Package

**Why First**: Multiple DRY violations require shared utilities that don't exist. This package centralizes non-storage-related shared code.

**New Package**: `packages/common`

```bash
# Create package structure
mkdir -p packages/common/src/{utils,errors,constants}
```

**Package Structure**:
```
packages/common/
  package.json
  tsconfig.json
  src/
    index.ts              # Main exports
    utils/
      env.ts              # Environment helpers
      hash.ts             # Hash generation
      format.ts           # Formatting utilities
      retry.ts            # Retry logic
      index.ts
    errors/
      base.ts             # Base error classes
      domain.ts           # Domain-specific errors
      index.ts
    constants/
      timeouts.ts         # Timeout values
      limits.ts           # Size/count limits
      intervals.ts        # Job intervals
      index.ts
```

**`package.json`**:
```json
{
  "name": "@engram/common",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@engram/tsconfig": "*",
    "typescript": "^5.8.3"
  }
}
```

**Utilities** (`src/utils/index.ts`):
```typescript
// Environment helpers (duplicated in search-core/config.ts and config/env.ts)
export function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === "true" || val === "1";
}

export function envNum(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
}

export function envStr(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

// Time formatting (duplicated in interface/SessionBrowser and SearchResults)
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

// ID truncation (duplicated in interface components)
export function truncateId(id: string, length = 8): string {
  return id.slice(0, length);
}

// Retry logic (missing in memory, execution)
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; backoffMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, backoffMs = 1000 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, backoffMs * attempt));
      }
    }
  }

  throw lastError;
}
```

**Migration from `@engram/storage`**:

Move these non-storage items from `storage` to `common`:
- `sha256Hash` function (if used outside blob context)
- Any shared type definitions not specific to storage

Keep in `@engram/storage`:
- `FalkorClient`, `GraphClient` interface
- `KafkaClient`, `MessageClient` interface
- `BlobStore` interface and implementation
- `RedisPublisher` interface and implementation

---

## Phase 1: Critical Type Safety & Error Handling

Address high-severity type safety and error handling issues across all components.

### 1.1 Remove All `as any` Type Bypasses

**Affected Files** (by priority):

| File | Count | Priority | Resolution |
|------|-------|----------|------------|
| `apps/execution/src/index.ts` | 6 | P0 | Create proper MCP SDK types |
| `apps/ingestion/src/index.ts` | 1 | P0 | Import KafkaClient types |
| `apps/search/src/index.ts` | 5 | P0 | Import Kafka message types |
| `apps/control/src/index.ts` | 1 | P0 | Use null pattern for SearchRetriever |
| `packages/ingestion-core/src/parser/*.ts` | 50+ | P1 | Add Zod schemas per parser |
| `packages/search-core/src/services/*.ts` | 8 | P1 | Type pipeline functions properly |
| `packages/logger/src/index.ts` | 1 | P2 | Fix level type |

**Unified Approach for Parser Type Safety** (`ingestion-core`):

```typescript
// packages/ingestion-core/src/parser/schemas.ts (NEW)
import { z } from "zod";

export const AnthropicMessageStartSchema = z.object({
  type: z.literal("message_start"),
  message: z.object({
    usage: z.object({
      input_tokens: z.number(),
    }).optional(),
  }).optional(),
});

export const OpenAIChunkSchema = z.object({
  choices: z.array(z.object({
    delta: z.object({
      content: z.string().optional(),
      tool_calls: z.array(z.object({
        id: z.string(),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })).optional(),
    }),
  })),
});

// Add schemas for all 8 parsers
```

---

### 1.2 Implement Consistent Error Types

**Create Shared Error Hierarchy in `@engram/common`**:

```typescript
// packages/common/src/errors/base.ts

export class EngramError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// packages/common/src/errors/domain.ts

import { EngramError } from "./base";

// Domain-specific errors
export class GraphOperationError extends EngramError {
  constructor(operation: string, cause?: Error) {
    super(`Graph operation failed: ${operation}`, 'GRAPH_ERROR', cause);
  }
}

export class ParseError extends EngramError {
  constructor(provider: string, cause?: Error) {
    super(`Failed to parse ${provider} event`, 'PARSE_ERROR', cause);
  }
}

export class ValidationError extends EngramError {
  constructor(field: string, expected: string, received: unknown) {
    super(`Validation failed for ${field}: expected ${expected}`, 'VALIDATION_ERROR');
  }
}

// Service-specific errors
export class RehydrationError extends EngramError {}
export class PatchApplicationError extends EngramError {}
export class ToolExecutionError extends EngramError {}
export class ContextAssemblyError extends EngramError {}
export class SessionInitializationError extends EngramError {}
```

**Error Handling Pattern** (apply everywhere):

```typescript
// BEFORE: Silent error swallowing
try {
  await operation();
} catch (_error) {
  return []; // Silent failure
}

// AFTER: Proper error handling
try {
  await operation();
} catch (error) {
  logger.error({ error, context }, "Operation failed");
  throw new GraphOperationError("operation", error instanceof Error ? error : undefined);
}
```

---

### 1.3 Fix Silent Error Swallowing

**Locations to Fix** (consolidated from all reports):

| File | Lines | Current Behavior | Fix |
|------|-------|------------------|-----|
| `apps/control/src/context/assembler.ts` | 113-116, 147-150 | Returns `[]` | Log + throw ContextAssemblyError |
| `apps/execution/packages/execution-core/src/rehydrator.ts` | 33-43 | Silent JSON parse | Log + throw RehydrationError |
| `apps/ingestion/src/index.ts` | 173-178 | Kafka errors logged only | Add to DLQ |
| `apps/memory/src/index.ts` | 84-87 | Silent message drop | Log warning |
| `packages/vfs/src/patch.ts` | 12-14 | Silent catch | Check error type, rethrow unexpected |
| `packages/logger/src/browser.ts` | 44-46 | Silent fetch failure | Add error callback |
| `packages/storage/src/blob.ts` | 78-83, 112-117 | Returns stub URI | Throw or use Result type |

---

## Phase 2: DRY Consolidation

Eliminate code duplication across the monorepo systematically.

### 2.1 Create Base Embedder Class (`search-core`)

**Problem**: 4 embedder classes share ~150 lines of duplicated singleton/lazy-load logic.

```typescript
// packages/search-core/src/services/base-embedder.ts (NEW)

export interface EmbedderConfig {
  modelName: string;
  taskType: "feature-extraction" | "text-generation";
  dtype?: "fp32" | "fp16" | "q8";
}

export abstract class BaseEmbedder {
  protected static instances = new Map<string, unknown>();
  protected abstract config: EmbedderConfig;

  protected async getInstance(): Promise<unknown> {
    const key = this.config.modelName;
    if (!BaseEmbedder.instances.has(key)) {
      const instance = await pipeline(
        this.config.taskType,
        this.config.modelName,
        this.config.dtype ? { dtype: this.config.dtype } : undefined
      );
      BaseEmbedder.instances.set(key, instance);
    }
    return BaseEmbedder.instances.get(key)!;
  }

  async preload(): Promise<void> {
    await this.getInstance();
  }

  abstract embed(text: string): Promise<number[]>;
}

// TextEmbedder, CodeEmbedder, ColBERTEmbedder, SpladeEmbedder extend this
```

---

### 2.2 Create Tag Extractor Base Class (`ingestion-core`)

**Problem**: `ThinkingExtractor` and `DiffExtractor` share ~80% identical logic.

```typescript
// packages/ingestion-core/src/extractors/base.ts (NEW)

export abstract class TagExtractor<TField extends string> {
  protected buffer = "";
  protected inBlock = false;

  protected abstract startMarker: string;
  protected abstract endMarker: string;
  protected abstract fieldName: TField;

  process(chunk: string): StreamDelta {
    this.buffer += chunk;
    const delta: StreamDelta = {};

    // Check for start marker
    if (!this.inBlock && this.buffer.includes(this.startMarker)) {
      const idx = this.buffer.indexOf(this.startMarker);
      const outside = this.buffer.slice(0, idx);
      if (outside) {
        delta.content = outside;
      }
      this.buffer = this.buffer.slice(idx + this.startMarker.length);
      this.inBlock = true;
    }

    // Check for end marker
    if (this.inBlock && this.buffer.includes(this.endMarker)) {
      const idx = this.buffer.indexOf(this.endMarker);
      const inside = this.buffer.slice(0, idx);
      (delta as Record<string, string>)[this.fieldName] = inside;
      this.buffer = this.buffer.slice(idx + this.endMarker.length);
      this.inBlock = false;
    }

    // Handle partial markers at end (shared logic)
    // ... existing partial marker detection

    return delta;
  }
}

// ThinkingExtractor
export class ThinkingExtractor extends TagExtractor<"thought"> {
  protected startMarker = "<thinking>";
  protected endMarker = "</thinking>";
  protected fieldName = "thought" as const;
}

// DiffExtractor
export class DiffExtractor extends TagExtractor<"diff"> {
  protected startMarker = "```diff";
  protected endMarker = "```";
  protected fieldName = "diff" as const;
}
```

---

### 2.3 Create Parser Registry (`ingestion-core`)

**Problem**: 8-way if-else chain in ingestion app; adding new parsers requires modifying code.

```typescript
// packages/ingestion-core/src/parser/registry.ts (NEW)

import type { ParserStrategy } from "./interface";

export class ParserRegistry {
  private static parsers = new Map<string, () => ParserStrategy>();

  static register(provider: string, factory: () => ParserStrategy): void {
    ParserRegistry.parsers.set(provider, factory);
  }

  static get(provider: string): ParserStrategy | undefined {
    const factory = ParserRegistry.parsers.get(provider);
    return factory?.();
  }

  static has(provider: string): boolean {
    return ParserRegistry.parsers.has(provider);
  }

  static providers(): string[] {
    return Array.from(ParserRegistry.parsers.keys());
  }
}

// Auto-register all parsers
ParserRegistry.register("anthropic", () => new AnthropicParser());
ParserRegistry.register("openai", () => new OpenAIParser());
ParserRegistry.register("xai", () => new XAIParser());
ParserRegistry.register("claude-code", () => new ClaudeCodeParser());
ParserRegistry.register("codex", () => new CodexParser());
ParserRegistry.register("gemini", () => new GeminiParser());
ParserRegistry.register("cline", () => new ClineParser());
ParserRegistry.register("opencode", () => new OpenCodeParser());
```

**Usage in `apps/ingestion`**:

```typescript
// BEFORE
if (provider === "anthropic") {
  delta = anthropicParser.parse(rawEvent.payload);
} else if (provider === "openai") {
  // ...8 more branches
}

// AFTER
const parser = ParserRegistry.get(provider);
if (!parser) {
  logger.warn({ provider }, "Unknown provider");
  return;
}
delta = parser.parse(rawEvent.payload);
```

---

### 2.4 Extract Shared Usage Extraction (`ingestion-core`)

**Problem**: 5 parsers duplicate identical usage token extraction logic.

```typescript
// packages/ingestion-core/src/parser/utils.ts (NEW)

export interface UsageFieldMap {
  input: string;
  output: string;
  cacheRead?: string;
  cacheWrite?: string;
  reasoning?: string;
}

export function extractUsage(
  raw: Record<string, unknown>,
  fieldMap: UsageFieldMap
): StreamDelta["usage"] {
  return {
    input: (raw[fieldMap.input] as number) || 0,
    output: (raw[fieldMap.output] as number) || 0,
    cacheRead: fieldMap.cacheRead ? (raw[fieldMap.cacheRead] as number) || 0 : undefined,
    cacheWrite: fieldMap.cacheWrite ? (raw[fieldMap.cacheWrite] as number) || 0 : undefined,
    reasoning: fieldMap.reasoning ? (raw[fieldMap.reasoning] as number) || 0 : undefined,
  };
}

export function buildToolCall(
  id: string,
  name: string,
  args: unknown,
  index = 0
): StreamDelta {
  return {
    type: "tool_call",
    toolCall: {
      id,
      name,
      args: typeof args === "string" ? args : JSON.stringify(args ?? {}),
      index,
    },
  };
}
```

---

### 2.5 Consolidate Configuration (`search-core`)

**Problem**: Two parallel config systems with duplicated env helpers.

**Target**: Single configuration module.

```typescript
// packages/search-core/src/config/index.ts (CONSOLIDATED)

// Remove: config.ts, config/env.ts duplication
// Keep: config/reranker-config.ts (merged into this)

import { envBool, envNum, envStr } from "@engram/common/utils";

export const CONFIG = {
  // Qdrant
  qdrant: {
    url: envStr("QDRANT_URL", "http://localhost:6333"),
    collection: envStr("QDRANT_COLLECTION", "engram_memory"),
  },

  // Embeddings
  embeddings: {
    textModel: envStr("TEXT_EMBEDDING_MODEL", "Xenova/all-MiniLM-L6-v2"),
    codeModel: envStr("CODE_EMBEDDING_MODEL", "Xenova/all-MiniLM-L6-v2"),
  },

  // Reranking (moved from RERANK_CONFIG)
  reranking: {
    enabled: envBool("ENABLE_RERANKING", true),
    model: envStr("RERANK_MODEL", "Xenova/ms-marco-MiniLM-L-6-v2"),
    batchSize: envNum("RERANK_BATCH_SIZE", 32),
    topK: envNum("RERANK_TOP_K", 10),
    idleTimeoutMs: envNum("RERANK_IDLE_TIMEOUT_MS", 5 * 60 * 1000),
  },

  // Cache
  cache: {
    redisUrl: envStr("REDIS_URL", ""),
    ttlSeconds: envNum("CACHE_TTL_SECONDS", 3600),
  },
} as const;

export type Config = typeof CONFIG;
```

---

### 2.6 Consolidate WebSocket Hook (`interface`)

**Problem**: `useSessionStream` and `useSessionsStream` share ~90% identical reconnection logic.

```typescript
// apps/interface/app/hooks/useWebSocket.ts (NEW)

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  maxReconnectAttempts?: number;
  reconnectBackoffMs?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  maxReconnectAttempts = 5,
  reconnectBackoffMs = 1000,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      onConnect?.();
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnect?.();

      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const backoff = reconnectBackoffMs * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        setTimeout(connect, backoff);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // Invalid JSON
      }
    };

    wsRef.current = ws;
  }, [url, onMessage, onConnect, onDisconnect, maxReconnectAttempts, reconnectBackoffMs]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { isConnected, send: (data: unknown) => wsRef.current?.send(JSON.stringify(data)) };
}
```

---

### 2.7 Create Shared UI Components (`interface`)

**Problem**: Duplicate Empty/Loading states, formatters, particles across components.

```
apps/interface/app/components/shared/
  EmptyState.tsx        # Generic empty state with configurable icon/colors
  LoadingSkeleton.tsx   # Generic loading skeleton
  Particles.tsx         # Floating particle effect (extracted from page.tsx)
  design-tokens.ts      # Centralized colors, spacing, animations
```

```typescript
// apps/interface/app/components/shared/design-tokens.ts (NEW)

export const colors = {
  amber: {
    50: "rgb(255, 251, 235)",
    400: "rgb(251, 191, 36)",
    500: "rgb(245, 158, 11)",
  },
  cyan: {
    400: "rgb(34, 211, 238)",
    500: "rgb(6, 182, 212)",
  },
  violet: {
    400: "rgb(167, 139, 250)",
    500: "rgb(139, 92, 246)",
  },
  // ... all colors used across components
} as const;

export const animations = {
  pulse: "pulse 2s infinite",
  float: "float 6s ease-in-out infinite",
  cardReveal: "cardReveal 0.3s ease-out forwards",
} as const;
```

---

## Phase 3: Architecture Improvements

Address structural issues that affect maintainability and testability.

### 3.1 Implement Repository Pattern (`memory-core`)

**Problem**: Raw Cypher queries scattered in business logic (control, memory apps).

```typescript
// packages/memory-core/src/repositories/index.ts (NEW)

export interface SessionRepository {
  findById(id: string): Promise<SessionNode | null>;
  create(session: SessionData): Promise<void>;
  update(id: string, updates: Partial<SessionData>): Promise<void>;
  upsertWithTimestamps(session: SessionData): Promise<void>;
}

export interface TurnRepository {
  create(turn: TurnData): Promise<string>;
  update(id: string, updates: Partial<TurnData>): Promise<void>;
  linkToSession(turnId: string, sessionId: string): Promise<void>;
  findActiveBySession(sessionId: string): Promise<TurnNode[]>;
}

export interface ReasoningRepository {
  create(reasoning: ReasoningData): Promise<string>;
  linkToTurn(reasoningId: string, turnId: string): Promise<void>;
}

export interface ToolCallRepository {
  create(toolCall: ToolCallData): Promise<string>;
  linkToTurn(toolCallId: string, turnId: string): Promise<void>;
}

// Implementation
export class FalkorSessionRepository implements SessionRepository {
  constructor(private client: GraphClient) {}

  async findById(id: string): Promise<SessionNode | null> {
    const result = await this.client.query<SessionNode>(
      `MATCH (s:Session {id: $id}) RETURN s`,
      { id }
    );
    return result[0] ?? null;
  }

  // ... other methods
}
```

**Usage Changes**:
- `apps/control/src/session/initializer.ts` → Use `SessionRepository`
- `apps/control/src/context/assembler.ts` → Use repositories instead of raw queries
- `apps/memory/src/index.ts` → Use `SessionRepository`
- `apps/memory/src/turn-aggregator.ts` → Use `TurnRepository`, `ReasoningRepository`, etc.

---

### 3.2 Extract Event Handler Strategy (`memory`)

**Problem**: 120-line switch statement in `TurnAggregator.processEvent()`.

```typescript
// apps/memory/src/handlers/index.ts (NEW)

export interface EventHandler {
  canHandle(event: ParsedEvent): boolean;
  handle(event: ParsedEvent, turn: TurnState, context: HandlerContext): Promise<void>;
}

export class ContentEventHandler implements EventHandler {
  canHandle(event: ParsedEvent): boolean {
    return event.type === "content";
  }

  async handle(event: ParsedEvent, turn: TurnState, context: HandlerContext): Promise<void> {
    turn.buffer += event.content || "";
    if (turn.buffer.length > 100) {
      await context.emitUpdate(turn);
    }
  }
}

export class ToolCallEventHandler implements EventHandler {
  canHandle(event: ParsedEvent): boolean {
    return event.type === "tool_call";
  }

  async handle(event: ParsedEvent, turn: TurnState, context: HandlerContext): Promise<void> {
    // Extract tool call handling from switch case
  }
}

// Registry
export class EventHandlerRegistry {
  private handlers: EventHandler[] = [];

  register(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  async dispatch(event: ParsedEvent, turn: TurnState, context: HandlerContext): Promise<void> {
    for (const handler of this.handlers) {
      if (handler.canHandle(event)) {
        await handler.handle(event, turn, context);
        return;
      }
    }
    // Unknown event type
  }
}
```

---

### 3.3 Implement Dependency Injection Pattern

**Problem**: Hard-coded dependencies in constructors make testing difficult.

**Standard Pattern** (apply to all apps):

```typescript
// Pattern for all services

// 1. Define dependencies interface
interface MemoryServiceDependencies {
  falkor: GraphClient;        // Interface, not concrete
  kafka: MessageClient;        // Interface
  redis: RedisPublisher;       // Interface
  logger: Logger;
  config: Config;
}

// 2. Create factory function
export function createMemoryService(deps?: Partial<MemoryServiceDependencies>): MemoryService {
  const defaults: MemoryServiceDependencies = {
    falkor: createFalkorClient(),
    kafka: createKafkaClient("memory-service"),
    redis: createRedisPublisher(),
    logger: createNodeLogger({ service: "memory-service" }),
    config: loadConfig(),
  };

  return new MemoryService({ ...defaults, ...deps });
}

// 3. Service accepts dependencies
class MemoryService {
  constructor(private deps: MemoryServiceDependencies) {}
}

// 4. Entry point wires everything
// index.ts
const service = createMemoryService();
await service.start();
```

**Apply to**:
- `apps/control` - DecisionEngine, ContextAssembler, SessionManager
- `apps/memory` - TurnAggregator, index.ts
- `apps/execution` - Rehydrator, TimeTravelService
- `apps/search` - SearchService
- `apps/ingestion` - IngestionProcessor

---

### 3.4 Add Interface Abstractions (`vfs`)

**Problem**: `PatchManager` depends on concrete `VirtualFileSystem`.

```typescript
// packages/vfs/src/interfaces.ts (NEW)

export interface IFileSystem {
  exists(path: string): boolean;
  mkdir(path: string): void;
  writeFile(path: string, content: string): void;
  readFile(path: string): string;
  readDir(path: string): string[];
}

// Update PatchManager
export class PatchManager {
  constructor(private fs: IFileSystem) {}  // Interface, not concrete
}
```

---

### 3.5 Split God Components (`interface`)

**Problem**: `SessionReplay.tsx` (1580 lines) and `LineageGraph.tsx` (1171 lines).

**Target Structure**:

```
app/components/SessionReplay/
  index.tsx              # Main component (~200 lines)
  MessageCards/
    ResponseCard.tsx
    QueryCard.tsx
    ToolCallCard.tsx
    ReasoningTrace.tsx
    TurnHeader.tsx
  StatsHeader.tsx
  LoadingState.tsx
  EmptyState.tsx
  utils/
    consolidateTimeline.ts
    messageUtils.ts

app/components/LineageGraph/
  index.tsx              # Main component (~200 lines)
  NeuralNode.tsx
  GraphStats.tsx
  layouts/
    radialLayout.ts
    gridLayout.ts
  config/
    nodeTypeConfig.ts
  EmptyState.tsx
  LoadingSkeleton.tsx
```

---

## Phase 4: Testing Infrastructure

Address critical testing gaps identified across all reports.

### 4.1 Missing Test Coverage (Critical)

| Component | Current | Target | Test Files to Create |
|-----------|---------|--------|---------------------|
| `apps/execution/src/index.ts` | 0% | 80% | `index.test.ts` |
| `apps/memory/src/turn-aggregator.ts` | 0% | 80% | `turn-aggregator.test.ts` |
| `apps/ingestion/src/index.ts` | 20% | 80% | Expand `index.test.ts` |
| `packages/ingestion-core/src/parser/openai.ts` | 0% | 80% | `openai.test.ts` |
| `packages/storage/src/redis.ts` | 0% | 80% | `redis.test.ts` |
| `apps/interface/lib/graph-queries.ts` | 0% | 80% | `graph-queries.test.ts` |

### 4.2 Integration Test Infrastructure

**Create Integration Test Utilities in `@engram/common`**:

```typescript
// packages/common/src/testing/index.ts (NEW)

import type { GraphClient, MessageClient, RedisPublisher } from "@engram/storage";

export async function createTestFalkorClient(): Promise<GraphClient> {
  // Uses testcontainers or mock
}

export async function createTestKafkaClient(): Promise<MessageClient> {
  // Uses testcontainers or mock
}

export async function createTestRedisPublisher(): Promise<RedisPublisher> {
  // Uses testcontainers or mock
}

// Example usage in tests
describe("TurnAggregator integration", () => {
  let falkor: GraphClient;
  let aggregator: TurnAggregator;

  beforeAll(async () => {
    falkor = await createTestFalkorClient();
    aggregator = new TurnAggregator(falkor);
  });

  // ...
});
```

---

## Phase 5: Cleanup & Polish

Lower-priority improvements after core issues are resolved.

### 5.1 Remove Dead Code

| File | Dead Code | Action |
|------|-----------|--------|
| `apps/search/src/routes/health.ts` | Entire file unused | Integrate or remove |
| `apps/memory/src/index.ts:176-216` | Legacy ThoughtNode | Remove (behind flag) |
| `packages/storage/package.json` | `kafkajs` unused | Remove dependency |
| `packages/ingestion-core/package.json` | `google-libphonenumber` unused | Remove |
| `packages/memory-core/package.json` | `ulid`, `date-fns` unused | Remove |

### 5.2 Remove Unused Dependencies

```bash
# storage
npm uninstall kafkajs  # Using @confluentinc/kafka-javascript via dynamic require

# ingestion-core
npm uninstall google-libphonenumber  # Using regex instead

# memory-core
npm uninstall ulid date-fns  # Not imported anywhere
```

### 5.3 Standardize Logging

**Pattern** (apply everywhere):

```typescript
// BEFORE: console.log
console.log(`Indexed node ${node.id}`);
console.error("Kafka Consumer Error:", e);

// AFTER: Structured logger
import { createNodeLogger } from "@engram/logger";

const logger = createNodeLogger({ service: "search-service" });
logger.info({ nodeId: node.id }, "Indexed node");
logger.error({ err: e }, "Kafka consumer error");
```

**Files to Update**:
- `apps/search/src/index.ts` (3 locations)
- `apps/ingestion/src/index.ts` (7 locations)
- `apps/control/src/tools/mcp_client.ts` (1 location)
- `packages/memory-core/src/merger.ts` (1 location)

### 5.4 Extract Magic Numbers to Constants

**Create Constants Files in `@engram/common`**:

```typescript
// packages/common/src/constants/timeouts.ts

export const TIMEOUTS = {
  GRAPH_QUERY_MS: 10000,
  TOOL_EXECUTION_MS: 30000,
  ERROR_RECOVERY_MS: 30000,
  WEBSOCKET_RECONNECT_MS: 1000,
  TURN_STALE_MS: 30 * 60 * 1000,  // 30 minutes
} as const;

// packages/common/src/constants/limits.ts

export const LIMITS = {
  CONTENT_MAX_LENGTH: 10000,
  PREVIEW_MAX_LENGTH: 2000,
  HISTORY_ITEMS: 20,
  MEMORY_RESULTS: 3,
  RERANK_TOP_K: 10,
} as const;

// packages/common/src/constants/intervals.ts

export const INTERVALS = {
  PRUNE_JOB_MS: 24 * 60 * 60 * 1000,  // 24 hours
  STALE_TURN_CLEANUP_MS: 5 * 60 * 1000,  // 5 minutes
  TURN_UPDATE_MS: 500,
} as const;

// packages/common/src/constants/index.ts
export * from "./timeouts";
export * from "./limits";
export * from "./intervals";
```

---

## Execution Order

### Week 1: Foundation
1. Phase 0.3: Create `@engram/common` package (utilities, errors, constants)
2. Phase 0.1: Create interface layer in `@engram/storage`
3. Phase 1.2: Add error types to `@engram/common`

### Week 2: Type Safety
1. Phase 1.1: Remove `as any` casts (prioritize P0)
2. Phase 1.3: Fix silent error swallowing
3. Phase 4.1: Add critical missing tests

### Week 3: DRY Consolidation
1. Phase 2.1: Base embedder class
2. Phase 2.2: Tag extractor base class
3. Phase 2.3: Parser registry
4. Phase 2.5: Consolidate configuration

### Week 4: Architecture
1. Phase 0.2: Consolidate domain types
2. Phase 3.1: Repository pattern
3. Phase 3.3: Dependency injection pattern

### Week 5: Frontend & Polish
1. Phase 2.6-2.7: Consolidate interface components
2. Phase 3.5: Split god components
3. Phase 5: Cleanup

### Week 6: Testing & Documentation
1. Phase 4.2: Integration test infrastructure
2. Remaining Phase 4.1 tests
3. Update documentation

---

## Risk Mitigation

### Breaking Changes

| Change | Risk | Mitigation |
|--------|------|------------|
| Type consolidation | Import paths change | Keep old exports as re-exports for one release |
| Interface introduction | Constructor signatures change | Use default implementations in factory functions |
| Config consolidation | Env var names may change | Add migration notes, support old vars temporarily |
| Component splitting | Import paths change | Use barrel exports (`index.ts`) |

### Testing Strategy

1. **Before each phase**: Ensure all existing tests pass
2. **During phase**: Add tests for new code
3. **After phase**: Run full integration test suite
4. **Rollback plan**: Each phase should be independently revertable via git

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| `as any` usage | 70+ | <10 | grep count |
| Test coverage | ~35% | >80% | vitest coverage |
| Duplicated code | ~15% | <5% | SonarQube/manual |
| Max file length | 1580 lines | <400 lines | wc -l |
| Max cyclomatic complexity | 25 | <10 | ESLint |
| Interface abstractions | 1 | 8 | Count |
| Silent error catches | 15+ | 0 | grep count |

---

## Appendix: Cross-Reference Matrix

### Which Apps Use Which Packages

| Package | control | memory | execution | search | ingestion | interface |
|---------|---------|--------|-----------|--------|-----------|-----------|
| `@engram/common` (NEW) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@engram/storage` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@engram/memory-core` | ✅ | ✅ | - | - | - | - |
| `@engram/search-core` | ✅ | - | - | ✅ | - | ✅ |
| `@engram/ingestion-core` | - | - | - | - | ✅ | - |
| `@engram/execution-core` | - | - | ✅ | - | - | - |
| `@engram/events` | ✅ | ✅ | - | - | ✅ | - |
| `@engram/logger` | ✅ | ✅ | ✅ | ✅ | declared | ✅ |
| `@engram/vfs` | - | - | ✅ | - | - | - |
| `@engram/infra` | - | - | - | - | - | - |

### Package Responsibilities After Refactoring

| Package | Responsibility |
|---------|---------------|
| `@engram/common` | Shared utilities, error types, constants, test helpers |
| `@engram/storage` | Database clients, interfaces, storage-specific implementations |
| `@engram/memory-core` | Domain types, graph operations, repositories |
| `@engram/logger` | Structured logging |

### Shared Concerns by Impact

1. **Common Utilities** (`@engram/common`) → All apps and packages (15 components)
2. **FalkorClient Interface** (`@engram/storage`) → control, memory, execution, memory-core (4 components)
3. **Error Types** (`@engram/common`) → All apps and packages (15 components)
4. **Logger Standardization** → control, memory, search, ingestion (4 apps)
5. **Config Pattern** → search-core, all apps (6 components)
6. **Parser Registry** → ingestion-core, ingestion (2 components)
7. **WebSocket Hook** → interface (1 app, 2 hooks)

---

*This plan represents a synergized analysis of 15 independent refactoring reports. Changes have been ordered to maximize interoperability and minimize conflicts.*
