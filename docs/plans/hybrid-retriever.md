# Complete Hybrid Search in SearchRetriever

## Overview

The `SearchRetriever` class currently only implements dense vector search. The sparse and hybrid search paths are stubs. This plan completes the implementation to leverage SPLADE sparse vectors for true hybrid search.

## Current State

**What works:**
- `SpladeEmbedder` generates sparse vectors ✓
- `TextEmbedder.embedSparseQuery()` exposes SPLADE for queries ✓
- Qdrant collection has `sparse` named vector field ✓
- Integration tests prove hybrid search with RRF fusion works at Qdrant level ✓
- `QueryClassifier` returns strategy + alpha weight ✓

**What's missing in `SearchRetriever.search()`:**
- Sparse-only search path returns empty array (line 84-87)
- Hybrid path just returns dense results (line 78-80)
- No call to `embedSparseQuery()` for sparse vectors
- No use of Qdrant's `prefetch` + `fusion: "rrf"` API

## Implementation Plan

### Phase 1: Sparse-Only Search

Implement the sparse search path for exact/keyword-focused queries.

**Changes to `retriever.ts`:**

```typescript
if (strategy === "sparse") {
    const sparseVector = await this.textEmbedder.embedSparseQuery(text);

    const results = await this.client.query(this.collectionName, {
        query: {
            indices: sparseVector.indices,
            values: sparseVector.values,
        },
        using: "sparse",
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        limit,
        with_payload: true,
        score_threshold: effectiveThreshold,
    });

    return results.points;
}
```

**Considerations:**
- Sparse search works for both text and code (SPLADE is content-agnostic)
- Score threshold for sparse is different (0.1 default vs 0.75 for dense)
- Return format should match dense results for consistency

### Phase 2: Hybrid Search with RRF Fusion

Implement true hybrid search using Qdrant's prefetch + fusion API.

**Changes to `retriever.ts`:**

```typescript
if (strategy === "hybrid") {
    // Generate both dense and sparse query vectors
    const [denseVector, sparseVector] = await Promise.all([
        isCodeSearch
            ? this.codeEmbedder.embedQuery(text)
            : this.textEmbedder.embedQuery(text),
        this.textEmbedder.embedSparseQuery(text),
    ]);

    // Prefetch from both vector spaces, fuse with RRF
    const results = await this.client.query(this.collectionName, {
        prefetch: [
            {
                query: denseVector,
                using: vectorName,  // "text_dense" or "code_dense"
                limit: limit * 2,   // Oversample for fusion
            },
            {
                query: {
                    indices: sparseVector.indices,
                    values: sparseVector.values,
                },
                using: "sparse",
                limit: limit * 2,
            },
        ],
        query: { fusion: "rrf" },
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        limit,
        with_payload: true,
    });

    return results.points;
}
```

**Considerations:**
- Oversample in prefetch (2x limit) to give RRF more candidates
- RRF fusion handles score normalization automatically
- No score_threshold with RRF (scores are rank-based, not similarity-based)
- Alpha from classifier could be used for weighted fusion in future

### Phase 3: Refactor for Clarity

Extract search strategies into separate methods for maintainability.

**New structure:**

```typescript
class SearchRetriever {
    async search(query: SearchQuery) {
        // ... setup code ...

        switch (strategy) {
            case "dense":
                return this.denseSearch(text, vectorName, filter, limit, threshold);
            case "sparse":
                return this.sparseSearch(text, filter, limit, threshold);
            case "hybrid":
                return this.hybridSearch(text, vectorName, filter, limit);
        }
    }

    private async denseSearch(...) { /* existing code */ }
    private async sparseSearch(...) { /* new */ }
    private async hybridSearch(...) { /* new */ }
}
```

### Phase 4: Update Tests

Add unit tests for new search paths.

**New test cases in `retriever.test.ts`:**

1. `should perform sparse-only search`
   - Mock embedSparseQuery
   - Verify client.query called with sparse vector format

2. `should perform hybrid search with RRF fusion`
   - Mock both embedQuery and embedSparseQuery
   - Verify client.query called with prefetch array
   - Verify fusion: "rrf" in query

3. `should use classifier when strategy not provided`
   - Already exists, but verify it triggers correct path

4. `should handle code search in hybrid mode`
   - Verify code_dense used in prefetch for type=code filter

---

## File Changes

### Modified Files
1. `packages/search-core/src/services/retriever.ts` - Implement sparse/hybrid paths
2. `packages/search-core/src/services/retriever.test.ts` - Add new test cases

### No New Files Required

---

## API Contract

The `SearchRetriever.search()` return type remains unchanged:

```typescript
interface SearchResult {
    id: string | number;
    score: number;
    payload: {
        content: string;
        node_id: string;
        session_id: string;
        type: "thought" | "code";
        timestamp: number;
        file_path?: string;
    };
}
```

All three strategies return the same shape, allowing the UI to be strategy-agnostic.

---

## Score Interpretation

| Strategy | Score Range | Meaning |
|----------|-------------|---------|
| Dense    | 0.0 - 1.0   | Cosine similarity (higher = more similar) |
| Sparse   | 0.0 - ∞     | Dot product of sparse vectors (higher = more keyword overlap) |
| Hybrid   | 0.0 - 1.0   | RRF rank score (higher = better combined rank) |

The UI should display scores as percentages for dense/hybrid, but may need different treatment for sparse scores.

---

## Dependencies

- Qdrant JS client supports `query()` with `prefetch` and `fusion` (verified in v1.16.2)
- SPLADE embedder is already integrated into TextEmbedder

---

## Testing Strategy

1. **Unit tests**: Mock Qdrant client, verify correct API calls
2. **Integration tests**: Already exist in `hybrid-search.integration.test.ts`
3. **Manual testing**: Use Search UI to verify end-to-end

---

## Rollout

1. Implement phases 1-2
2. Run existing integration tests to verify no regression
3. Add unit tests (phase 4)
4. Refactor if needed (phase 3)
5. Deploy - Search UI will automatically benefit
