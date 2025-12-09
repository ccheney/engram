import type { RerankerTier } from "../models/schema";

// Re-export RerankerTier for convenience
export type { RerankerTier } from "../models/schema";

/**
 * Tier-specific configuration for a reranker model.
 */
export interface TierConfig {
	/** Model identifier (Hugging Face model ID or API model name) */
	model: string;
	/** Maximum number of candidates to rerank in this tier */
	maxCandidates: number;
	/** Batch size for processing (local models only) */
	batchSize: number;
	/** Whether this tier is enabled */
	enabled: boolean;
}

/**
 * Query routing heuristics configuration.
 */
export interface RoutingConfig {
	/** Character count threshold for "complex" queries that need accurate tier */
	complexityThreshold: number;
	/** Weight for code pattern matching (0-1) */
	codePatternWeight: number;
	/** Default latency budget in milliseconds */
	latencyBudgetDefault: number;
	/** Regex patterns that indicate code queries */
	codePatterns: RegExp[];
	/** Regex patterns that indicate agentic/tool queries */
	agenticPatterns: RegExp[];
}

/**
 * Caching configuration for reranker system.
 */
export interface CacheConfig {
	/** Maximum size of embedding cache (number of entries) */
	embeddingCacheMaxSize: number;
	/** Embedding cache TTL in milliseconds */
	embeddingCacheTTLMs: number;
	/** Query cache TTL in milliseconds */
	queryCacheTTLMs: number;
	/** Enable query result caching */
	queryCacheEnabled: boolean;
}

/**
 * Rate limiting configuration for LLM tier.
 */
export interface RateLimitConfig {
	/** Maximum requests per hour per user */
	requestsPerHour: number;
	/** Budget limit in cents */
	budgetLimit: number;
	/** Cost per request in cents */
	costPerRequest: number;
}

/**
 * A/B testing configuration for gradual rollout.
 */
export interface ABTestingConfig {
	/** Enable A/B testing */
	enabled: boolean;
	/** Percentage of users with reranking enabled (0-100) */
	rolloutPercentage: number;
}

/**
 * Complete configuration for the reranking system.
 */
export interface RerankerConfig {
	// Global settings
	/** Enable/disable reranking globally */
	enabled: boolean;
	/** Default tier to use if auto-routing is disabled */
	defaultTier: RerankerTier;
	/** Timeout for reranking operations in milliseconds */
	timeoutMs: number;

	// Tier-specific settings
	tiers: {
		fast: TierConfig;
		accurate: TierConfig;
		code: TierConfig;
		llm: TierConfig;
	};

	// Routing settings
	routing: RoutingConfig;

	// Caching settings
	cache: CacheConfig;

	// Rate limiting (primarily for LLM tier)
	rateLimit: RateLimitConfig;

	// A/B testing
	abTesting: ABTestingConfig;
}

/**
 * Default tier configuration values.
 */
export const DEFAULT_TIER_CONFIGS: Record<RerankerTier, TierConfig> = {
	fast: {
		model: "Xenova/ms-marco-MiniLM-L-6-v2",
		maxCandidates: 50,
		batchSize: 16,
		enabled: true,
	},
	accurate: {
		model: "Xenova/bge-reranker-base",
		maxCandidates: 30,
		batchSize: 8,
		enabled: true,
	},
	code: {
		model: "jinaai/jina-reranker-v2-base-multilingual",
		maxCandidates: 30,
		batchSize: 8,
		enabled: true,
	},
	llm: {
		model: "grok-4-1-fast-reasoning",
		maxCandidates: 10,
		batchSize: 1,
		enabled: true,
	},
};

/**
 * Default routing configuration.
 */
export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
	complexityThreshold: 50,
	codePatternWeight: 0.8,
	latencyBudgetDefault: 500,
	codePatterns: [
		/\w+\.\w+\(/, // method calls: foo.bar()
		/function\s+\w+/, // function declarations
		/class\s+\w+/, // class declarations
		/import\s+/, // import statements
		/export\s+/, // export statements
		/const\s+\w+\s*=/, // variable declarations
		/interface\s+\w+/, // interface declarations
		/type\s+\w+/, // type declarations
	],
	agenticPatterns: [/tool|function|call|execute|invoke|run/i],
};

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
	embeddingCacheMaxSize: 10000,
	embeddingCacheTTLMs: 3600000, // 1 hour
	queryCacheTTLMs: 300000, // 5 minutes
	queryCacheEnabled: true,
};

/**
 * Default rate limit configuration.
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
	requestsPerHour: 100,
	budgetLimit: 1000, // $10
	costPerRequest: 5, // 5 cents
};

/**
 * Default A/B testing configuration.
 */
export const DEFAULT_AB_TESTING_CONFIG: ABTestingConfig = {
	enabled: false,
	rolloutPercentage: 100,
};

/**
 * Default complete reranker configuration.
 */
export const DEFAULT_RERANKER_CONFIG: RerankerConfig = {
	enabled: true,
	defaultTier: "fast",
	timeoutMs: 500,
	tiers: DEFAULT_TIER_CONFIGS,
	routing: DEFAULT_ROUTING_CONFIG,
	cache: DEFAULT_CACHE_CONFIG,
	rateLimit: DEFAULT_RATE_LIMIT_CONFIG,
	abTesting: DEFAULT_AB_TESTING_CONFIG,
};
