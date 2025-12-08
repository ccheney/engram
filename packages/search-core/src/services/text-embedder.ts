import { pipeline } from "@huggingface/transformers";

/**
 * BM25-based sparse vector generator for hybrid search.
 * Uses term frequency with sublinear scaling and document length normalization.
 */
class BM25Sparse {
	// BM25 parameters
	private k1 = 1.2; // Term frequency saturation parameter
	private b = 0.75; // Length normalization parameter
	private avgDocLength = 100; // Assumed average document length
	private vocabSize = 30000; // Hash space for token indices

	/**
	 * Simple tokenizer: lowercase, split on non-alphanumeric, filter short tokens
	 */
	private tokenize(text: string): string[] {
		return text
			.toLowerCase()
			.split(/[^a-z0-9]+/)
			.filter((t) => t.length > 1);
	}

	/**
	 * Hash a string to a consistent integer index within vocab range.
	 * Uses FNV-1a hash for good distribution.
	 */
	private hashToken(token: string): number {
		let hash = 2166136261; // FNV offset basis
		for (let i = 0; i < token.length; i++) {
			hash ^= token.charCodeAt(i);
			hash = Math.imul(hash, 16777619); // FNV prime
		}
		// Ensure positive index within vocab range
		return Math.abs(hash) % this.vocabSize;
	}

	/**
	 * Generate sparse vector from text using BM25-like scoring.
	 * Returns indices (token hashes) and values (BM25 weights).
	 */
	embed(text: string): { indices: number[]; values: number[] } {
		const tokens = this.tokenize(text);
		if (tokens.length === 0) {
			return { indices: [], values: [] };
		}

		// Count term frequencies
		const termFreqs = new Map<string, number>();
		for (const token of tokens) {
			termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
		}

		// Calculate BM25-like weights
		const docLength = tokens.length;
		const lengthNorm = 1 - this.b + this.b * (docLength / this.avgDocLength);

		const indexValuePairs: Array<[number, number]> = [];

		for (const [term, tf] of termFreqs) {
			// BM25 term frequency component (without IDF since we don't have corpus stats)
			// Using sublinear TF scaling: tf / (tf + k1 * lengthNorm)
			const tfScore = tf / (tf + this.k1 * lengthNorm);

			// Apply log scaling to smooth weights
			const weight = Math.log1p(tfScore * 10);

			const index = this.hashToken(term);
			indexValuePairs.push([index, weight]);
		}

		// Sort by index for consistent ordering (Qdrant expects sorted indices)
		indexValuePairs.sort((a, b) => a[0] - b[0]);

		// Handle hash collisions by summing weights for same index
		const merged = new Map<number, number>();
		for (const [idx, val] of indexValuePairs) {
			merged.set(idx, (merged.get(idx) || 0) + val);
		}

		const sortedEntries = Array.from(merged.entries()).sort((a, b) => a[0] - b[0]);

		return {
			indices: sortedEntries.map(([idx]) => idx),
			values: sortedEntries.map(([, val]) => val),
		};
	}
}

export class TextEmbedder {
	private static instance: unknown;
	private static modelName = "Xenova/multilingual-e5-small"; // ONNX quantized version
	private sparseEmbedder = new BM25Sparse();

	static async getInstance() {
		if (!TextEmbedder.instance) {
			TextEmbedder.instance = await pipeline("feature-extraction", TextEmbedder.modelName);
		}
		return TextEmbedder.instance;
	}

	async embed(text: string): Promise<number[]> {
		const extractor = await TextEmbedder.getInstance();
		// Normalize "query: " prefix for e5 models if needed, but for general content we use "passage: "
		// The e5 model expects "query: " for queries and "passage: " for docs.
		// For simplicity, we assume this is "passage" (storage).
		// We should probably expose a method for 'query' vs 'document'.
		const extractFn = extractor as (
			text: string,
			opts: { pooling: string; normalize: boolean },
		) => Promise<{ data: Float32Array }>;
		const output = await extractFn(`passage: ${text}`, { pooling: "mean", normalize: true });
		return Array.from(output.data);
	}

	async embedQuery(text: string): Promise<number[]> {
		const extractor = await TextEmbedder.getInstance();
		const extractFn = extractor as (
			text: string,
			opts: { pooling: string; normalize: boolean },
		) => Promise<{ data: Float32Array }>;
		const output = await extractFn(`query: ${text}`, { pooling: "mean", normalize: true });
		return Array.from(output.data);
	}

	/**
	 * Generate sparse vector using BM25-based term weighting.
	 * Returns indices (hashed token IDs) and values (BM25 weights).
	 * Used for keyword matching in hybrid search alongside dense vectors.
	 */
	async embedSparse(text: string): Promise<{ indices: number[]; values: number[] }> {
		return this.sparseEmbedder.embed(text);
	}

	/**
	 * Generate sparse vector for queries.
	 * Currently identical to document embedding, but could be tuned differently.
	 */
	async embedSparseQuery(text: string): Promise<{ indices: number[]; values: number[] }> {
		return this.sparseEmbedder.embed(text);
	}
}
