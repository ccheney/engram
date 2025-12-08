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

### Medium-term (Tracked: the-system-djr)
If sparse retrieval quality is insufficient:
1. Convert SPLADE-distilbert to ONNX
2. Implement SpladePooling in JavaScript
3. Benchmark against improved BM25

**Detailed Implementation Steps:**
```bash
# 1. Install Optimum for ONNX conversion (Python)
pip install optimum[exporters]

# 2. Convert model to ONNX
optimum-cli export onnx --model naver/splade-v3-distilbert ./splade-onnx/

# 3. The output will include:
#    - model.onnx (the transformer model)
#    - tokenizer files (tokenizer.json, vocab.txt, etc.)
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
- Official SPLADE ONNX model releases
- Native sparse encoder support
- FastEmbed JS library availability

## Sources
- [SPLADE GitHub](https://github.com/naver/splade)
- [naver/splade-v3](https://huggingface.co/naver/splade-v3)
- [Sentence Transformers Sparse Encoder](https://sbert.net/examples/sparse_encoder/applications/computing_embeddings/README.html)
- [Pinecone SPLADE Guide](https://www.pinecone.io/learn/splade/)
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
