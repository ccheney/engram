import { pipeline } from "@huggingface/transformers";

/**
 * ColBERTEmbedder generates token-level embeddings for late interaction reranking.
 *
 * Model: jinaai/jina-colbert-v2 (559M parameters, 89 languages)
 * - Token dimension: 128
 * - Late interaction via MaxSim scoring
 * - 180x fewer FLOPs than cross-encoders at k=10
 *
 * Architecture:
 * 1. Documents: Pre-computed token embeddings stored in Qdrant multivector field
 * 2. Queries: Token embeddings computed at search time
 * 3. Scoring: MaxSim algorithm between query and document tokens
 */
export class ColBERTEmbedder {
	private static instance: unknown;
	private static modelName = "jinaai/jina-colbert-v2";

	/**
	 * Get or create singleton pipeline instance.
	 * Uses lazy loading - model is only loaded on first use.
	 */
	static async getInstance(): Promise<unknown> {
		if (!ColBERTEmbedder.instance) {
			console.log(`[ColBERTEmbedder] Loading model ${ColBERTEmbedder.modelName}...`);
			ColBERTEmbedder.instance = await pipeline("feature-extraction", ColBERTEmbedder.modelName, {
				dtype: "q8", // Quantized for efficiency
			});
			console.log("[ColBERTEmbedder] Model loaded successfully");
		}
		return ColBERTEmbedder.instance;
	}

	/**
	 * Encode document into token-level embeddings (128d per token).
	 * These embeddings are pre-computed at index time and stored in Qdrant.
	 *
	 * @param content - Document text to encode
	 * @returns Array of token embeddings (each token is 128d vector)
	 */
	async encodeDocument(content: string): Promise<Float32Array[]> {
		const extractor = await ColBERTEmbedder.getInstance();
		const extractFn = extractor as (
			text: string,
			opts: { pooling: string; normalize: boolean },
		) => Promise<{ data: Float32Array }>;

		// ColBERT uses token-level embeddings (no pooling)
		// Returns shape: [num_tokens, 128]
		const output = await extractFn(`passage: ${content}`, {
			pooling: "none", // Token-level embeddings
			normalize: true,
		});

		// Split flat array into per-token embeddings
		const tokenDim = 128;
		const numTokens = output.data.length / tokenDim;
		const tokenEmbeddings: Float32Array[] = [];

		for (let i = 0; i < numTokens; i++) {
			const start = i * tokenDim;
			const end = start + tokenDim;
			tokenEmbeddings.push(output.data.slice(start, end) as Float32Array);
		}

		return tokenEmbeddings;
	}

	/**
	 * Encode query for MaxSim scoring.
	 * Computed at search time for each query.
	 *
	 * @param query - Query text to encode
	 * @returns Array of token embeddings (each token is 128d vector)
	 */
	async encodeQuery(query: string): Promise<Float32Array[]> {
		const extractor = await ColBERTEmbedder.getInstance();
		const extractFn = extractor as (
			text: string,
			opts: { pooling: string; normalize: boolean },
		) => Promise<{ data: Float32Array }>;

		// ColBERT uses token-level embeddings (no pooling)
		// Returns shape: [num_tokens, 128]
		const output = await extractFn(`query: ${query}`, {
			pooling: "none", // Token-level embeddings
			normalize: true,
		});

		// Split flat array into per-token embeddings
		const tokenDim = 128;
		const numTokens = output.data.length / tokenDim;
		const tokenEmbeddings: Float32Array[] = [];

		for (let i = 0; i < numTokens; i++) {
			const start = i * tokenDim;
			const end = start + tokenDim;
			tokenEmbeddings.push(output.data.slice(start, end) as Float32Array);
		}

		return tokenEmbeddings;
	}

	/**
	 * Preload the model for faster first embedding.
	 */
	async preload(): Promise<void> {
		await ColBERTEmbedder.getInstance();
	}
}
