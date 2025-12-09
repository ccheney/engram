# Sparse Embedding Model Evaluation

## Current Implementation (Updated)

The `BM25Sparse` class in `packages/search-core/src/services/text-embedder.ts` now uses:
- **BERT tokenizer** via `AutoTokenizer.from_pretrained("Xenova/bert-base-uncased")`
- BERT vocabulary (30,522 tokens) - no more hash collisions
- BM25-like term frequency saturation (k1=1.2, b=0.75)
- Async tokenization with lazy-loaded tokenizer singleton

Remaining limitations:
- No IDF weighting (treats all terms equally important)
- No learned term expansion (unlike SPLADE)

## SPLADE Models Evaluation

### Models Available on Hugging Face
- `naver/splade-v3` - Latest version, trained with KL-Div and MarginMSE
- `naver/splade-cocondenser-ensembledistil` - Popular v2 variant
- `naver/splade-v3-distilbert` - Lighter distilled version

### Key Advantages of SPLADE
1. **Learned sparse representations** - Uses BERT MLM head to generate token importance weights
2. **Query/document expansion** - Adds semantically related terms not in original text
3. **Handles vocabulary mismatch** - Better synonym and typo handling
4. **Outperforms BM25** - Consistently better on benchmarks

### JavaScript/Transformers.js Support
**Status: Not directly supported**

- SPLADE models use MLM head + SpladePooling (max + ReLU)
- No ONNX weights published for SPLADE models
- Would require manual conversion and custom post-processing

### Implementation Path (if pursuing)
1. Convert `naver/splade-v3-distilbert` to ONNX using Optimum
2. Use transformers.js fill-mask pipeline to get MLM logits
3. Apply max pooling + ReLU to generate sparse vectors
4. Map token IDs to vocabulary indices

Estimated effort: 3-5 days including testing

## Alternative: BGE-M3

BGE-M3 (BAAI/bge-m3) supports hybrid retrieval with:
- Dense embeddings (1024d)
- Sparse embeddings (vocabulary-based)
- ColBERT-style multi-vector

**Status:** Also requires ONNX conversion, similar complexity to SPLADE.

## Recommendations

### Short-term ✅ COMPLETED
~~Improve current BM25 implementation:~~
1. ~~Add IDF estimation based on document frequency stats~~ (deferred - requires corpus stats)
2. ✅ Use proper tokenizer (from transformers.js) instead of hash
3. ~~Store corpus statistics in Qdrant collection metadata~~ (deferred)

### Medium-term (Tracked: the-system-djr) - RESEARCH COMPLETE

**Status:** Pre-converted ONNX models now available on HuggingFace!

#### Available SPLADE ONNX Models (as of Dec 2024)

| Model | Size | Notes |
|-------|------|-------|
| `sparse-encoder-testing/splade-bert-tiny-nq-onnx` | 4.42M params | **Best for JS** - tiny, fast |
| `andersonbcdefg/distilbert-splade-onnx` | 66.4M params | DistilBERT-based |
| `castorini/splade-v3-onnx` | ~110M params | Official SPLADE v3 |
| `onnx-models/Splade_PP_en_v1-onnx` | 0.41 GB | Dense output (768d), not sparse |

#### Recommended: `splade-bert-tiny-nq-onnx`
- **Output:** 30,522-dimensional sparse vectors
- **Architecture:** MLMTransformer + SpladePooling(max, relu)
- **License:** Apache 2.0
- **Performance:** NanoBEIR Mean NDCG@10 = 0.2627

#### Implementation Path for JavaScript

1. **No manual ONNX conversion needed** - use pre-converted model
2. Load ONNX model with `onnxruntime-web` or `transformers.js`
3. Apply SpladePooling post-processing (if not baked into model)

**Detailed Implementation Steps (UPDATED):**
```bash
# No conversion needed! Use pre-converted model:
# sparse-encoder-testing/splade-bert-tiny-nq-onnx
```

**JavaScript SpladePooling Implementation:**
```javascript
// After running the MLM head, apply SPLADE pooling:
function spladePooling(mlmLogits: Float32Array, vocabSize: number): { indices: number[], values: number[] } {
  // mlmLogits shape: [seqLen, vocabSize]
  const sparse = new Float32Array(vocabSize);

  // Max pooling over sequence length + ReLU
  for (let v = 0; v < vocabSize; v++) {
    let maxVal = 0;
    for (let s = 0; s < seqLen; s++) {
      const logit = mlmLogits[s * vocabSize + v];
      maxVal = Math.max(maxVal, logit);
    }
    // ReLU + log(1 + x) for SPLADE scoring
    sparse[v] = maxVal > 0 ? Math.log1p(maxVal) : 0;
  }

  // Extract non-zero indices and values
  const indices: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < vocabSize; i++) {
    if (sparse[i] > 0) {
      indices.push(i);
      values.push(sparse[i]);
    }
  }

  return { indices, values };
}
```

### Long-term
Monitor transformers.js for:
- ~~Official SPLADE ONNX model releases~~ ✅ Now available!
- Native sparse encoder support in transformers.js
- FastEmbed JS library availability

### Next Steps (If Implementing)

1. **Download and test** `sparse-encoder-testing/splade-bert-tiny-nq-onnx`
2. **Create SpladeEmbedder class** in `packages/search-core/src/services/`
3. **Benchmark** against current BM25Sparse implementation
4. **Integrate** with Qdrant sparse vector search

Estimated effort reduced from 3-5 days to **1-2 days** due to pre-converted models.

## Sources
- [SPLADE GitHub](https://github.com/naver/splade)
- [naver/splade-v3](https://huggingface.co/naver/splade-v3)
- [Sentence Transformers Sparse Encoder](https://sbert.net/examples/sparse_encoder/applications/computing_embeddings/README.html)
- [Sentence Transformers v5.0 Release](https://github.com/UKPLab/sentence-transformers/releases/tag/v5.0.0)
- [Training Sparse Encoders Blog](https://huggingface.co/blog/train-sparse-encoder)
- [SPLADE ONNX Models on HuggingFace](https://huggingface.co/models?search=splade+onnx)
- [splade-bert-tiny-nq-onnx](https://huggingface.co/sparse-encoder-testing/splade-bert-tiny-nq-onnx)
- [Pinecone SPLADE Guide](https://www.pinecone.io/learn/splade/)
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
