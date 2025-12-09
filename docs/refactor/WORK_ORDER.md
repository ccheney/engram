# Engram Refactoring Work Order

**Generated**: 2025-12-09
**Scope**: Full monorepo - 6 apps, 9 packages
**Total Issues**: 200+ across 15 independent analyses

---

## Executive Summary

This work order synthesizes 15 independent refactoring analyses into a prioritized, dependency-aware execution plan. The refactoring addresses 200+ identified issues across code quality, architecture, testing, and type safety.

### Issue Distribution

| Category | Total | High | Medium | Low |
|----------|-------|------|--------|-----|
| Code Duplication (DRY) | 47 | 12 | 23 | 12 |
| Type Safety | 38 | 8 | 21 | 9 |
| SOLID Violations | 34 | 9 | 17 | 8 |
| Testing Gaps | 31 | 11 | 14 | 6 |
| Architecture | 28 | 8 | 15 | 5 |
| Error Handling | 22 | 5 | 12 | 5 |

### Critical Cross-Cutting Blockers

These must be resolved first as they block multiple downstream tasks:

1. **`@engram/storage` Interface Layer** - 8 components depend on concrete `FalkorClient`
2. **`@engram/common` Package** - Required for shared utilities, errors, constants
3. **Domain Type Consolidation** - Types scattered between `memory-core`, `storage`, and apps
4. **Parser Registry** - Missing in `ingestion-core`, blocks ingestion app refactoring
5. **Logger Standardization** - Mix of `console.log` and `@engram/logger` across services

---

## Dependency Graph

```
Phase 0 (Foundation) ─────────────────────────────────────────┐
  │                                                           │
  ├── 0.1 Create @engram/common package                       │
  │     └── Exports: env helpers, error types, constants      │
  │                                                           │
  ├── 0.2 Create interface layer in @engram/storage           │
  │     └── GraphClient, MessageClient, BlobStore interfaces  │
  │                                                           │
  └── 0.3 Consolidate domain types in @engram/memory-core     │
        └── Move types from storage/falkor.ts                 │
                                                              │
Phase 1 (Type Safety) ◄───────────────────────────────────────┤
  │                                                           │
  ├── 1.1 Remove `as any` casts (P0 files)                    │
  │     ├── apps/execution (6 casts)                          │
  │     ├── apps/ingestion (1 cast)                           │
  │     ├── apps/search (5 casts)                             │
  │     └── apps/control (1 cast)                             │
  │                                                           │
  ├── 1.2 Add Zod schemas to ingestion-core parsers           │
  │     └── Runtime validation for all 8 parsers              │
  │                                                           │
  └── 1.3 Fix silent error swallowing                         │
        ├── apps/control/context/assembler.ts                 │
        ├── packages/execution-core/rehydrator.ts             │
        └── packages/storage/blob.ts                          │
                                                              │
Phase 2 (DRY) ◄───────────────────────────────────────────────┤
  │                                                           │
  ├── 2.1 Create BaseEmbedder class (search-core)             │
  │     └── Unifies 4 embedder classes (~150 LOC saved)       │
  │                                                           │
  ├── 2.2 Create TagExtractor base (ingestion-core)           │
  │     └── Unifies ThinkingExtractor/DiffExtractor           │
  │                                                           │
  ├── 2.3 Create ParserRegistry (ingestion-core)              │
  │     └── Replaces 8-way if-else in ingestion app           │
  │                                                           │
  ├── 2.4 Consolidate config (search-core)                    │
  │     └── Merge config.ts and config/reranker-config.ts     │
  │                                                           │
  └── 2.5 Create useWebSocket hook (interface)                │
        └── Unifies useSessionStream/useSessionsStream        │
                                                              │
Phase 3 (Architecture) ◄──────────────────────────────────────┤
  │                                                           │
  ├── 3.1 Repository pattern (memory-core)                    │
  │     └── SessionRepository, TurnRepository interfaces      │
  │                                                           │
  ├── 3.2 Event handler strategy (memory app)                 │
  │     └── Replace 120-line switch in TurnAggregator         │
  │                                                           │
  ├── 3.3 Dependency injection (all apps)                     │
  │     └── Factory functions with injectable deps            │
  │                                                           │
  └── 3.4 IFileSystem interface (vfs)                         │
        └── Enable PatchManager mocking                       │
                                                              │
Phase 4 (Testing) ◄───────────────────────────────────────────┤
  │                                                           │
  ├── 4.1 Critical missing tests                              │
  │     ├── apps/execution/index.ts (0% → 80%)                │
  │     ├── apps/memory/turn-aggregator.ts (0% → 80%)         │
  │     ├── packages/ingestion-core/parser/openai.ts          │
  │     └── packages/storage/redis.ts (0% → 80%)              │
  │                                                           │
  └── 4.2 Integration test infrastructure                     │
        └── Test helpers in @engram/common                    │
                                                              │
Phase 5 (Frontend & Polish) ◄─────────────────────────────────┤
  │                                                           │
  ├── 5.1 Split SessionReplay.tsx (1580 lines)                │
  ├── 5.2 Split LineageGraph.tsx (1171 lines)                 │
  ├── 5.3 Extract shared UI components                        │
  └── 5.4 Remove dead code & unused deps                      │
```

---

## Phase 0: Foundation (Prerequisites)

**Duration**: 2-3 days
**Blocking**: All subsequent phases
**Parallelization**: Tasks 0.1, 0.2, 0.3 can run in parallel

### Task 0.1: Create `@engram/common` Package

| Item | Details |
|------|---------|
| **Priority** | P0 |
| **Effort** | 4 hours |
| **Dependencies** | None |
| **Blocks** | Phases 1, 2, 3, 4, 5 |

**Deliverables**:
```
packages/common/
  package.json
  tsconfig.json
  src/
    index.ts
    utils/
      env.ts       # envBool, envNum, envStr
      hash.ts      # sha256Hash
      format.ts    # formatRelativeTime, truncateId
      retry.ts     # withRetry
    errors/
      base.ts      # EngramError
      domain.ts    # GraphOperationError, ParseError, ValidationError
    constants/
      timeouts.ts  # GRAPH_QUERY_MS, TOOL_EXECUTION_MS
      limits.ts    # CONTENT_MAX_LENGTH, HISTORY_ITEMS
      intervals.ts # PRUNE_JOB_MS, STALE_TURN_CLEANUP_MS
```

**Validation**:
- [ ] All apps can import `@engram/common`
- [ ] Existing duplicate code removed from apps
- [ ] Unit tests pass

---

### Task 0.2: Create Interface Layer in `@engram/storage`

| Item | Details |
|------|---------|
| **Priority** | P0 |
| **Effort** | 4 hours |
| **Dependencies** | None |
| **Blocks** | Tasks 1.1, 3.1, 3.3 |

**Deliverables**:
```typescript
// packages/storage/src/interfaces.ts (NEW)
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

export interface RedisPublisher {
  publishSessionUpdate(sessionId: string, event: unknown): Promise<void>;
  disconnect(): Promise<void>;
}
```

**Changes Required**:
- Update `FalkorClient` to implement `GraphClient`
- Update `KafkaClient` to implement `MessageClient`
- Export interfaces from `packages/storage/src/index.ts`
- Add missing `redis.ts` export

**Dependent Components** (must be updated after):
- `apps/control` - ContextAssembler, SessionInitializer
- `apps/memory` - TurnAggregator, index.ts
- `apps/execution` - Rehydrator, TimeTravelService
- `apps/search` - SearchService
- `packages/memory-core` - GraphWriter, GraphMerger, GraphPruner
- `packages/search-core` - SearchRetriever, SearchIndexer

---

### Task 0.3: Consolidate Domain Type Definitions

| Item | Details |
|------|---------|
| **Priority** | P0 |
| **Effort** | 6 hours |
| **Dependencies** | None |
| **Blocks** | Task 3.1 |

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
```

**Migration Steps**:
1. Move domain types from `storage/falkor.ts` to `memory-core/models/`
2. Update `storage/falkor.ts` to import from `memory-core` for domain types
3. Remove aliased re-exports from `memory-core/models/base.ts`
4. Update all consumers to import from `memory-core`

---

## Phase 1: Type Safety & Error Handling

**Duration**: 3-4 days
**Dependencies**: Phase 0 complete
**Parallelization**: Tasks 1.1, 1.2, 1.3 can run in parallel

### Task 1.1: Remove `as any` Type Bypasses

| Item | Details |
|------|---------|
| **Priority** | P0 |
| **Effort** | 8 hours |
| **Dependencies** | Task 0.2 |

**Files by Priority**:

| File | Count | Resolution |
|------|-------|------------|
| `apps/execution/src/index.ts` | 6 | Create proper MCP SDK types |
| `apps/ingestion/src/index.ts` | 1 | Import KafkaClient types |
| `apps/search/src/index.ts` | 5 | Import Kafka message types |
| `apps/control/src/index.ts` | 1 | Use null pattern for SearchRetriever |
| `packages/search-core/src/services/*.ts` | 8 | Type pipeline functions properly |
| `packages/logger/src/index.ts` | 1 | Fix level type |

---

### Task 1.2: Add Zod Schemas to Parsers

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 8 hours |
| **Dependencies** | Task 0.1 |

**Deliverables**:
```typescript
// packages/ingestion-core/src/parser/schemas.ts (NEW)
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

**Parsers to Update**:
- AnthropicParser
- OpenAIParser
- ClaudeCodeParser
- GeminiParser
- CodexParser
- ClineParser
- XAIParser
- OpenCodeParser

---

### Task 1.3: Fix Silent Error Swallowing

| Item | Details |
|------|---------|
| **Priority** | P0 |
| **Effort** | 4 hours |
| **Dependencies** | Task 0.1 (error types) |

**Locations to Fix**:

| File | Lines | Current Behavior | Fix |
|------|-------|------------------|-----|
| `apps/control/src/context/assembler.ts` | 113-116, 147-150 | Returns `[]` | Log + throw ContextAssemblyError |
| `packages/execution-core/src/rehydrator.ts` | 33-43 | Silent JSON parse | Log + throw RehydrationError |
| `apps/ingestion/src/index.ts` | 173-178 | Kafka errors logged only | Add to DLQ |
| `apps/memory/src/index.ts` | 84-87 | Silent message drop | Log warning |
| `packages/vfs/src/patch.ts` | 12-14 | Silent catch | Check error type, rethrow unexpected |
| `packages/logger/src/browser.ts` | 44-46 | Silent fetch failure | Add error callback |
| `packages/storage/src/blob.ts` | 78-83, 112-117 | Returns stub URI | Throw or use Result type |

---

## Phase 2: DRY Consolidation

**Duration**: 4-5 days
**Dependencies**: Phase 1 complete
**Parallelization**: All tasks can run in parallel

### Task 2.1: Create BaseEmbedder Class

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 4 hours |
| **Dependencies** | None |
| **LOC Saved** | ~150 lines |

**Location**: `packages/search-core/src/services/base-embedder.ts`

**Classes to Refactor**:
- TextEmbedder
- CodeEmbedder
- ColBERTEmbedder
- SpladeEmbedder

---

### Task 2.2: Create TagExtractor Base Class

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 3 hours |
| **Dependencies** | None |
| **LOC Saved** | ~80 lines |

**Location**: `packages/ingestion-core/src/extractors/base.ts`

**Classes to Refactor**:
- ThinkingExtractor
- DiffExtractor

---

### Task 2.3: Create Parser Registry

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 4 hours |
| **Dependencies** | None |
| **Blocks** | Ingestion app refactoring |

**Location**: `packages/ingestion-core/src/parser/registry.ts`

**Changes Required**:
- Create `ParserRegistry` class with `register()`, `get()`, `has()`, `providers()`
- Auto-register all 8 parsers
- Update `apps/ingestion/src/index.ts` to use registry

---

### Task 2.4: Consolidate Configuration (search-core)

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 3 hours |
| **Dependencies** | Task 0.1 (env helpers) |

**Files to Merge**:
- `packages/search-core/src/config.ts`
- `packages/search-core/src/config/reranker-config.ts`
- `packages/search-core/src/config/env.ts`

**Target**: Single `packages/search-core/src/config/index.ts`

---

### Task 2.5: Create Shared WebSocket Hook

| Item | Details |
|------|---------|
| **Priority** | P2 |
| **Effort** | 3 hours |
| **Dependencies** | None |
| **LOC Saved** | ~80 lines |

**Location**: `apps/interface/app/hooks/useWebSocket.ts`

**Hooks to Refactor**:
- useSessionStream
- useSessionsStream

---

## Phase 3: Architecture Improvements

**Duration**: 5-7 days
**Dependencies**: Phase 2 complete
**Parallelization**: Tasks 3.1, 3.2 can run in parallel; 3.3 depends on 3.1

### Task 3.1: Implement Repository Pattern

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 12 hours |
| **Dependencies** | Tasks 0.2, 0.3 |

**Location**: `packages/memory-core/src/repositories/`

**Interfaces**:
- SessionRepository
- TurnRepository
- ReasoningRepository
- ToolCallRepository

**Usage Changes**:
- `apps/control/src/session/initializer.ts` → Use `SessionRepository`
- `apps/control/src/context/assembler.ts` → Use repositories
- `apps/memory/src/index.ts` → Use `SessionRepository`
- `apps/memory/src/turn-aggregator.ts` → Use repositories

---

### Task 3.2: Extract Event Handler Strategy (memory app)

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 6 hours |
| **Dependencies** | None |

**Location**: `apps/memory/src/handlers/`

**Replace**: 120-line switch statement in `TurnAggregator.processEvent()`

**Handlers to Create**:
- ContentEventHandler
- ThoughtEventHandler
- ToolCallEventHandler
- DiffEventHandler
- UsageEventHandler
- ControlEventHandler

---

### Task 3.3: Implement Dependency Injection Pattern

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 10 hours |
| **Dependencies** | Task 3.1 |

**Pattern**: Factory functions with injectable dependencies

**Apps to Update**:
- `apps/control` - DecisionEngine, ContextAssembler, SessionManager
- `apps/memory` - TurnAggregator, index.ts
- `apps/execution` - Rehydrator, TimeTravelService
- `apps/search` - SearchService
- `apps/ingestion` - IngestionProcessor

---

### Task 3.4: Add IFileSystem Interface (vfs)

| Item | Details |
|------|---------|
| **Priority** | P2 |
| **Effort** | 2 hours |
| **Dependencies** | None |

**Location**: `packages/vfs/src/interfaces.ts`

**Interface**:
```typescript
export interface IFileSystem {
  exists(path: string): boolean;
  mkdir(path: string): void;
  writeFile(path: string, content: string): void;
  readFile(path: string): string;
  readDir(path: string): string[];
}
```

---

## Phase 4: Testing Infrastructure

**Duration**: 5-7 days
**Dependencies**: Phase 3 complete
**Parallelization**: All tasks can run in parallel

### Task 4.1: Critical Missing Tests

| Component | Current | Target | Effort |
|-----------|---------|--------|--------|
| `apps/execution/src/index.ts` | 0% | 80% | 6 hours |
| `apps/memory/src/turn-aggregator.ts` | 0% | 80% | 8 hours |
| `packages/ingestion-core/src/parser/openai.ts` | 0% | 80% | 4 hours |
| `packages/storage/src/redis.ts` | 0% | 80% | 4 hours |
| `apps/interface/lib/graph-queries.ts` | 0% | 80% | 6 hours |
| `apps/control/src/context/assembler.ts` | 0% | 80% | 4 hours |

---

### Task 4.2: Integration Test Infrastructure

| Item | Details |
|------|---------|
| **Priority** | P1 |
| **Effort** | 8 hours |
| **Dependencies** | Task 0.1 |

**Location**: `packages/common/src/testing/`

**Utilities to Create**:
- `createTestFalkorClient()`
- `createTestKafkaClient()`
- `createTestRedisPublisher()`
- Test fixture helpers

---

## Phase 5: Frontend & Polish

**Duration**: 4-5 days
**Dependencies**: Phase 4 complete
**Parallelization**: Tasks 5.1-5.3 can run in parallel

### Task 5.1: Split SessionReplay.tsx

| Item | Details |
|------|---------|
| **Priority** | P2 |
| **Effort** | 8 hours |
| **Current LOC** | 1580 lines |
| **Target LOC** | ~200 per file |

**Target Structure**:
```
app/components/SessionReplay/
  index.tsx              # Main component
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
```

---

### Task 5.2: Split LineageGraph.tsx

| Item | Details |
|------|---------|
| **Priority** | P2 |
| **Effort** | 6 hours |
| **Current LOC** | 1171 lines |
| **Target LOC** | ~200 per file |

**Target Structure**:
```
app/components/LineageGraph/
  index.tsx
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

### Task 5.3: Extract Shared UI Components

| Item | Details |
|------|---------|
| **Priority** | P2 |
| **Effort** | 4 hours |
| **Dependencies** | Tasks 5.1, 5.2 |

**Location**: `apps/interface/app/components/shared/`

**Components**:
- EmptyState.tsx
- LoadingSkeleton.tsx
- Particles.tsx
- design-tokens.ts

---

### Task 5.4: Remove Dead Code & Unused Dependencies

| Item | Details |
|------|---------|
| **Priority** | P3 |
| **Effort** | 2 hours |
| **Dependencies** | None |

**Dead Code**:

| File | Dead Code | Action |
|------|-----------|--------|
| `apps/search/src/routes/health.ts` | Entire file unused | Integrate or remove |
| `apps/memory/src/index.ts:176-216` | Legacy ThoughtNode | Remove (behind flag) |

**Unused Dependencies**:

| Package | Dependency | Action |
|---------|------------|--------|
| `packages/storage` | `kafkajs` | Remove |
| `packages/ingestion-core` | `google-libphonenumber` | Remove |
| `packages/memory-core` | `ulid`, `date-fns` | Remove |
| `apps/control` | `@ai-sdk/openai` | Remove |

---

## Parallelization Guide

### Maximum Parallel Work Streams

```
Stream A (Foundation)     Stream B (Type Safety)    Stream C (DRY)
────────────────────     ────────────────────      ──────────────
Phase 0.1 ─────────┐
Phase 0.2 ─────────┤
Phase 0.3 ─────────┘
                   │
                   ├──→ Phase 1.1 ───────────┐
                   ├──→ Phase 1.2            │
                   └──→ Phase 1.3            │
                                             │
                                             ├──→ Phase 2.1
                                             ├──→ Phase 2.2
                                             ├──→ Phase 2.3
                                             ├──→ Phase 2.4
                                             └──→ Phase 2.5
```

### Safe Parallel Combinations

| Combination | Notes |
|-------------|-------|
| 0.1 + 0.2 + 0.3 | All foundation tasks |
| 1.1 + 1.2 + 1.3 | All type safety tasks |
| 2.1 + 2.2 + 2.3 + 2.4 + 2.5 | All DRY tasks |
| 3.1 + 3.2 | Repository + Event handlers |
| 4.1 (all subtasks) | All testing tasks |
| 5.1 + 5.2 | Both god component splits |

### Dependencies That Block Parallelization

| Blocked Task | Blocking Task | Reason |
|--------------|---------------|--------|
| 1.1 | 0.2 | Need interfaces to remove `as any` |
| 3.1 | 0.2, 0.3 | Repository depends on interfaces and types |
| 3.3 | 3.1 | DI needs repository interfaces |
| 5.3 | 5.1, 5.2 | Shared components extracted from splits |

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

## Appendix: Component Dependency Matrix

### Which Apps Use Which Packages

| Package | control | memory | execution | search | ingestion | interface |
|---------|:-------:|:------:|:---------:|:------:|:---------:|:---------:|
| `@engram/common` (NEW) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@engram/storage` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@engram/memory-core` | ✅ | ✅ | - | - | - | - |
| `@engram/search-core` | ✅ | - | - | ✅ | - | ✅ |
| `@engram/ingestion-core` | - | - | - | - | ✅ | - |
| `@engram/execution-core` | - | - | ✅ | - | - | - |
| `@engram/events` | ✅ | ✅ | - | - | ✅ | - |
| `@engram/logger` | ✅ | ✅ | ✅ | ✅ | declared | ✅ |
| `@engram/vfs` | - | - | ✅ | - | - | - |

---

## Beads Integration

To track this work in the beads system:

```bash
# Create epic for refactoring
bd create --title="Engram Comprehensive Refactoring" --type=feature

# Create phase milestones
bd create --title="Phase 0: Foundation" --type=task
bd create --title="Phase 1: Type Safety" --type=task
bd create --title="Phase 2: DRY Consolidation" --type=task
bd create --title="Phase 3: Architecture" --type=task
bd create --title="Phase 4: Testing" --type=task
bd create --title="Phase 5: Frontend & Polish" --type=task

# Add dependencies
bd dep add <phase-1-id> <phase-0-id>
bd dep add <phase-2-id> <phase-1-id>
bd dep add <phase-3-id> <phase-2-id>
bd dep add <phase-4-id> <phase-3-id>
bd dep add <phase-5-id> <phase-4-id>
```

---

*This work order synthesizes 15 independent refactoring analyses. See individual reports in `docs/refactor/` for detailed file-by-file analysis.*
