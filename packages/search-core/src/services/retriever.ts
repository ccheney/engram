import { QdrantClient } from "@qdrant/js-client-rest";
import { DEFAULT_SEARCH_CONFIG } from "../config";
import type { SearchQuery } from "../models/schema";
import { QueryClassifier } from "./classifier";
import { CodeEmbedder } from "./code-embedder";
import { TextEmbedder } from "./text-embedder";

export class SearchRetriever {
	private client: QdrantClient;
	private textEmbedder: TextEmbedder;
	private codeEmbedder: CodeEmbedder;
	private classifier: QueryClassifier;
	private collectionName = "engram_memory";

	constructor(url: string = "http://localhost:6333") {
		this.client = new QdrantClient({ url });
		this.textEmbedder = new TextEmbedder();
		this.codeEmbedder = new CodeEmbedder();
		this.classifier = new QueryClassifier();
	}

	async search(query: SearchQuery) {
		const {
			text,
			limit = DEFAULT_SEARCH_CONFIG.limits.defaultResults,
			strategy: userStrategy,
			filters,
			threshold,
		} = query;

		// Determine strategy using classifier if not provided
		let strategy = userStrategy;
		if (!strategy) {
			const classification = this.classifier.classify(text);
			strategy = classification.strategy;
			// We could use classification.alpha for hybrid weighting later
		}

		const effectiveThreshold = threshold ?? DEFAULT_SEARCH_CONFIG.minScore[strategy];

		// Determine which vector field to use based on type filter
		const isCodeSearch = filters?.type === "code";
		const vectorName = isCodeSearch ? "code_dense" : "text_dense";

		// Build Filter
		const filter: Record<string, unknown> = {};
		if (filters) {
			const conditions = [];
			if (filters.session_id) {
				conditions.push({ key: "session_id", match: { value: filters.session_id } });
			}
			if (filters.type) {
				conditions.push({ key: "type", match: { value: filters.type } });
			}
			if (conditions.length > 0) {
				filter.must = conditions;
			}
		}

		// Dense Search
		if (strategy === "dense") {
			const vector = isCodeSearch
				? await this.codeEmbedder.embedQuery(text)
				: await this.textEmbedder.embedQuery(text);

			const denseResults = await this.client.search(this.collectionName, {
				vector: {
					name: vectorName,
					vector: vector,
				},
				filter: Object.keys(filter).length > 0 ? filter : undefined,
				limit,
				with_payload: true,
				score_threshold: effectiveThreshold,
			});

			return denseResults;
		}

		// Hybrid Search (Dense + Sparse with RRF Fusion)
		if (strategy === "hybrid") {
			// Generate both dense and sparse query vectors in parallel
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
						using: vectorName,
						limit: limit * 2, // Oversample for fusion
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
				// No score_threshold with RRF (scores are rank-based, not similarity-based)
			});

			return results.points;
		}

		// Sparse Search
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
	}
}
