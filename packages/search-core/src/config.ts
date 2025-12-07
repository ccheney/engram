export interface SearchConfig {
	minScore: {
		dense: number;
		sparse: number;
		hybrid: number;
	};
	limits: {
		maxResults: number;
		defaultResults: number;
	};
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
	minScore: {
		// Tuned for e5-small (cosine similarity)
		// e5-small scores are usually between 0.7 and 0.9 for relevant items.
		// < 0.75 is often irrelevant noise.
		dense: 0.75,

		// Sparse (BM25/SPLADE) scores are unbounded but usually normalized or relative.
		// Assuming some normalization or raw score threshold.
		// For Qdrant sparse, it depends on payload.
		sparse: 0.1,

		// RRF/Hybrid fusion score (0-1 usually)
		hybrid: 0.5,
	},
	limits: {
		maxResults: 100,
		defaultResults: 10,
	},
};
