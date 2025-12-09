import { AutoTokenizer, pipeline } from "@huggingface/transformers";
import { SpladeEmbedder } from "./splade-embedder";

/**
 * Sparse embedder type for TextEmbedder configuration.
 * - "splade": Learned sparse embeddings via SPLADE (recommended)
 * - "bm25": Traditional BM25-based term weighting (fallback)
 */
export type SparseEmbedderType = "splade" | "bm25";

/**
 * BM25-based sparse vector generator for hybrid search.
 * Uses BERT tokenizer for vocabulary-based indexing and BM25 scoring.
 * @deprecated Use SpladeEmbedder for better semantic matching
 */
class BM25Sparse {
	// BM25 parameters
	private k1 = 1.2; // Term frequency saturation parameter
	private b = 0.75; // Length normalization parameter
	private avgDocLength = 100; // Assumed average document length

	// Tokenizer instance (lazy loaded)
	private static tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null = null;
	private static tokenizerPromise: Promise<
		Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>
	> | null = null;

	/**
	 * Get or initialize the BERT tokenizer.
	 * Uses bert-base-uncased vocabulary (30522 tokens).
	 */
	private async getTokenizer() {
		if (BM25Sparse.tokenizer) {
			return BM25Sparse.tokenizer;
		}
		if (!BM25Sparse.tokenizerPromise) {
			BM25Sparse.tokenizerPromise = AutoTokenizer.from_pretrained("Xenova/bert-base-uncased");
		}
		BM25Sparse.tokenizer = await BM25Sparse.tokenizerPromise;
		return BM25Sparse.tokenizer;
	}

	/**
	 * Tokenize text using BERT tokenizer and return token IDs.
	 * Filters out special tokens ([CLS], [SEP], [PAD]).
	 */
	private async tokenize(text: string): Promise<number[]> {
		const tokenizer = await this.getTokenizer();
		const encoded = tokenizer(text, { add_special_tokens: false });
		// Extract token IDs from tensor
		const inputIds = encoded.input_ids;
		const ids: number[] = [];
		// Handle both tensor and array formats
		if (inputIds.data) {
			for (const id of inputIds.data) {
				ids.push(Number(id));
			}
		} else if (Array.isArray(inputIds)) {
			for (const id of inputIds.flat()) {
				ids.push(Number(id));
			}
		}
		return ids;
	}

	/**
	 * Generate sparse vector from text using BM25-like scoring.
	 * Returns indices (BERT vocabulary token IDs) and values (BM25 weights).
	 */
	async embed(text: string): Promise<{ indices: number[]; values: number[] }> {
		const tokenIds = await this.tokenize(text);
		if (tokenIds.length === 0) {
			return { indices: [], values: [] };
		}

		// Count term frequencies by token ID
		const termFreqs = new Map<number, number>();
		for (const tokenId of tokenIds) {
			termFreqs.set(tokenId, (termFreqs.get(tokenId) || 0) + 1);
		}

		// Calculate BM25-like weights
		const docLength = tokenIds.length;
		const lengthNorm = 1 - this.b + this.b * (docLength / this.avgDocLength);

		const indexValuePairs: Array<[number, number]> = [];

		for (const [tokenId, tf] of termFreqs) {
			// BM25 term frequency component (without IDF since we don't have corpus stats)
			// Using sublinear TF scaling: tf / (tf + k1 * lengthNorm)
			const tfScore = tf / (tf + this.k1 * lengthNorm);

			// Apply log scaling to smooth weights
			const weight = Math.log1p(tfScore * 10);

			indexValuePairs.push([tokenId, weight]);
		}

		// Sort by index for consistent ordering (Qdrant expects sorted indices)
		indexValuePairs.sort((a, b) => a[0] - b[0]);

		return {
			indices: indexValuePairs.map(([idx]) => idx),
			values: indexValuePairs.map(([, val]) => val),
		};
	}
}

/**
 * Common interface for sparse embedders.
 */
interface SparseEmbedderInterface {
	embed(text: string): Promise<{ indices: number[]; values: number[] }>;
	embedQuery?(text: string): Promise<{ indices: number[]; values: number[] }>;
}

export class TextEmbedder {
	private static instance: unknown;
	private static modelName = "Xenova/multilingual-e5-small"; // ONNX quantized version
	private sparseEmbedder: SparseEmbedderInterface;
	private sparseType: SparseEmbedderType;

	/**
	 * Create a TextEmbedder with configurable sparse embedding strategy.
	 * @param sparseType - "splade" (default, learned sparse) or "bm25" (traditional fallback)
	 */
	constructor(sparseType: SparseEmbedderType = "splade") {
		this.sparseType = sparseType;
		this.sparseEmbedder = sparseType === "splade" ? new SpladeEmbedder() : new BM25Sparse();
	}

	/**
	 * Get the current sparse embedding type.
	 */
	getSparseType(): SparseEmbedderType {
		return this.sparseType;
	}

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
	 * Generate sparse vector using learned sparse embeddings (SPLADE) or BM25 fallback.
	 * Returns indices (vocabulary token IDs) and values (term importance weights).
	 * Uses SPLADE by default for better semantic matching in hybrid search.
	 */
	async embedSparse(text: string): Promise<{ indices: number[]; values: number[] }> {
		return this.sparseEmbedder.embed(text);
	}

	/**
	 * Generate sparse vector for queries.
	 * Uses SPLADE's query embedding if available, otherwise same as document embedding.
	 */
	async embedSparseQuery(text: string): Promise<{ indices: number[]; values: number[] }> {
		if (this.sparseEmbedder.embedQuery) {
			return this.sparseEmbedder.embedQuery(text);
		}
		return this.sparseEmbedder.embed(text);
	}

	/**
	 * Preload the sparse embedder model (useful for SPLADE which needs to load ONNX model).
	 */
	async preloadSparse(): Promise<void> {
		if (this.sparseType === "splade" && this.sparseEmbedder instanceof SpladeEmbedder) {
			await this.sparseEmbedder.preload();
		}
	}
}
