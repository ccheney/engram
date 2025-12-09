import type { RerankerTier } from "./models/schema";

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

// =============================================================================
// Reranking Configuration
// =============================================================================

export interface RerankerTierConfig {
	model: string;
	maxLatencyMs: number;
	batchSize?: number;
	maxCandidates?: number;
}

export interface RerankConfig {
	enabled: boolean;
	defaultTier: RerankerTier;
	depth: number;
	timeoutMs: number;

	tiers: Record<RerankerTier, RerankerTierConfig>;

	routing: {
		/** Regex patterns that indicate code queries */
		codePatterns: RegExp[];
		/** Character count threshold for "complex" queries */
		complexThreshold: number;
		/** Regex patterns that indicate agentic/tool queries */
		agenticPatterns: RegExp[];
	};

	cache: {
		/** TTL for query result cache in seconds */
		queryResultTTL: number;
		/** TTL for document representation cache in seconds */
		documentRepresentationTTL: number;
		/** Maximum cache size in bytes */
		maxCacheSize: number;
	};
}

/** Helper to parse boolean from env */
function envBool(key: string, defaultValue: boolean): boolean {
	const val = process.env[key];
	if (val === undefined) return defaultValue;
	return val.toLowerCase() === "true" || val === "1";
}

/** Helper to parse number from env */
function envNum(key: string, defaultValue: number): number {
	const val = process.env[key];
	if (val === undefined) return defaultValue;
	const parsed = Number.parseInt(val, 10);
	return Number.isNaN(parsed) ? defaultValue : parsed;
}

/** Helper to get string from env */
function envStr(key: string, defaultValue: string): string {
	return process.env[key] ?? defaultValue;
}

export const RERANK_CONFIG: RerankConfig = {
	enabled: envBool("RERANK_ENABLED", true),
	defaultTier: (envStr("RERANK_DEFAULT_TIER", "fast") as RerankerTier) || "fast",
	depth: envNum("RERANK_DEPTH", 30),
	timeoutMs: envNum("RERANK_TIMEOUT_MS", 500),

	tiers: {
		fast: {
			model: envStr("RERANK_MODEL_FAST", "Xenova/ms-marco-MiniLM-L-6-v2"),
			maxLatencyMs: 50,
			batchSize: 16,
		},
		accurate: {
			model: envStr("RERANK_MODEL_ACCURATE", "Xenova/bge-reranker-base"),
			maxLatencyMs: 150,
			batchSize: 8,
		},
		code: {
			model: envStr("RERANK_MODEL_CODE", "jinaai/jina-reranker-v2-base-multilingual"),
			maxLatencyMs: 150,
			batchSize: 8,
		},
		llm: {
			model: envStr("LLM_RERANK_MODEL", "grok-4-1-fast-reasoning"),
			maxLatencyMs: 2000,
			maxCandidates: envNum("LLM_RERANK_MAX_CANDIDATES", 10),
		},
	},

	routing: {
		// Patterns that indicate code queries
		codePatterns: [
			/\w+\.\w+\(/, // method calls: foo.bar()
			/function\s+\w+/, // function declarations
			/class\s+\w+/, // class declarations
			/import\s+/, // import statements
			/export\s+/, // export statements
			/const\s+\w+\s*=/, // variable declarations
		],
		// Queries longer than this are considered "complex"
		complexThreshold: 50,
		// Patterns that indicate agentic/tool-use queries
		agenticPatterns: [/tool|function|call|execute|invoke|run/i],
	},

	cache: {
		queryResultTTL: 300, // 5 minutes
		documentRepresentationTTL: 3600, // 1 hour
		maxCacheSize: 1024 * 1024 * 1024, // 1GB
	},
};
