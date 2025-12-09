import { z } from "zod";
import type { RerankerTier } from "../models/schema";
import {
	DEFAULT_AB_TESTING_CONFIG,
	DEFAULT_CACHE_CONFIG,
	DEFAULT_RATE_LIMIT_CONFIG,
	DEFAULT_RERANKER_CONFIG,
	DEFAULT_ROUTING_CONFIG,
	DEFAULT_TIER_CONFIGS,
	type RerankerConfig,
} from "./reranker-config";

/**
 * Environment variable schema for reranker configuration.
 * Validates and parses all reranker-related environment variables.
 */
const EnvSchema = z.object({
	// Global settings
	RERANKER_ENABLED: z
		.string()
		.optional()
		.default("true")
		.transform((val) => val.toLowerCase() === "true" || val === "1"),
	RERANKER_DEFAULT_TIER: z.enum(["fast", "accurate", "code", "llm"]).optional().default("fast"),
	RERANKER_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(500),

	// Tier-specific settings
	RERANKER_FAST_MODEL: z.string().optional(),
	RERANKER_FAST_MAX_CANDIDATES: z.coerce.number().int().positive().optional(),
	RERANKER_FAST_BATCH_SIZE: z.coerce.number().int().positive().optional(),
	RERANKER_FAST_ENABLED: z
		.string()
		.optional()
		.transform((val) => val === undefined || val.toLowerCase() === "true" || val === "1"),

	RERANKER_ACCURATE_MODEL: z.string().optional(),
	RERANKER_ACCURATE_MAX_CANDIDATES: z.coerce.number().int().positive().optional(),
	RERANKER_ACCURATE_BATCH_SIZE: z.coerce.number().int().positive().optional(),
	RERANKER_ACCURATE_ENABLED: z
		.string()
		.optional()
		.transform((val) => val === undefined || val.toLowerCase() === "true" || val === "1"),

	RERANKER_CODE_MODEL: z.string().optional(),
	RERANKER_CODE_MAX_CANDIDATES: z.coerce.number().int().positive().optional(),
	RERANKER_CODE_BATCH_SIZE: z.coerce.number().int().positive().optional(),
	RERANKER_CODE_ENABLED: z
		.string()
		.optional()
		.transform((val) => val === undefined || val.toLowerCase() === "true" || val === "1"),

	RERANKER_LLM_MODEL: z.string().optional(),
	RERANKER_LLM_MAX_CANDIDATES: z.coerce.number().int().positive().optional(),
	RERANKER_LLM_ENABLED: z
		.string()
		.optional()
		.transform((val) => val === undefined || val.toLowerCase() === "true" || val === "1"),

	// Routing settings
	RERANKER_COMPLEXITY_THRESHOLD: z.coerce.number().int().positive().optional(),
	RERANKER_CODE_PATTERN_WEIGHT: z.coerce.number().min(0).max(1).optional(),
	RERANKER_LATENCY_BUDGET: z.coerce.number().int().positive().optional(),

	// Cache settings
	RERANKER_CACHE_ENABLED: z
		.string()
		.optional()
		.default("true")
		.transform((val) => val.toLowerCase() === "true" || val === "1"),
	RERANKER_EMBEDDING_CACHE_MAX_SIZE: z.coerce.number().int().positive().optional(),
	RERANKER_EMBEDDING_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
	RERANKER_QUERY_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),

	// Rate limiting
	RERANKER_RATE_LIMIT_REQUESTS_PER_HOUR: z.coerce.number().int().positive().optional(),
	RERANKER_RATE_LIMIT_BUDGET: z.coerce.number().int().positive().optional(),
	RERANKER_RATE_LIMIT_COST_PER_REQUEST: z.coerce.number().positive().optional(),

	// A/B testing
	RERANKER_AB_ENABLED: z
		.string()
		.optional()
		.default("false")
		.transform((val) => val.toLowerCase() === "true" || val === "1"),
	RERANKER_AB_ROLLOUT: z.coerce.number().min(0).max(100).optional().default(100),

	// API keys (optional, required for LLM tier)
	XAI_API_KEY: z.string().optional(),
	REDIS_URL: z.string().optional(),
});

type EnvConfig = z.infer<typeof EnvSchema>;

/**
 * Load and validate environment variables for reranker configuration.
 * Merges environment variables with defaults.
 *
 * @returns Validated reranker configuration
 * @throws {z.ZodError} If environment variables are invalid
 */
export function loadConfigFromEnv(): RerankerConfig {
	// Parse and validate environment variables
	const env = EnvSchema.parse(process.env);

	// Build configuration from environment with fallback to defaults
	const config: RerankerConfig = {
		enabled: env.RERANKER_ENABLED,
		defaultTier: env.RERANKER_DEFAULT_TIER as RerankerTier,
		timeoutMs: env.RERANKER_TIMEOUT_MS,

		tiers: {
			fast: {
				model: env.RERANKER_FAST_MODEL ?? DEFAULT_TIER_CONFIGS.fast.model,
				maxCandidates: env.RERANKER_FAST_MAX_CANDIDATES ?? DEFAULT_TIER_CONFIGS.fast.maxCandidates,
				batchSize: env.RERANKER_FAST_BATCH_SIZE ?? DEFAULT_TIER_CONFIGS.fast.batchSize,
				enabled: env.RERANKER_FAST_ENABLED ?? DEFAULT_TIER_CONFIGS.fast.enabled,
			},
			accurate: {
				model: env.RERANKER_ACCURATE_MODEL ?? DEFAULT_TIER_CONFIGS.accurate.model,
				maxCandidates:
					env.RERANKER_ACCURATE_MAX_CANDIDATES ?? DEFAULT_TIER_CONFIGS.accurate.maxCandidates,
				batchSize: env.RERANKER_ACCURATE_BATCH_SIZE ?? DEFAULT_TIER_CONFIGS.accurate.batchSize,
				enabled: env.RERANKER_ACCURATE_ENABLED ?? DEFAULT_TIER_CONFIGS.accurate.enabled,
			},
			code: {
				model: env.RERANKER_CODE_MODEL ?? DEFAULT_TIER_CONFIGS.code.model,
				maxCandidates: env.RERANKER_CODE_MAX_CANDIDATES ?? DEFAULT_TIER_CONFIGS.code.maxCandidates,
				batchSize: env.RERANKER_CODE_BATCH_SIZE ?? DEFAULT_TIER_CONFIGS.code.batchSize,
				enabled: env.RERANKER_CODE_ENABLED ?? DEFAULT_TIER_CONFIGS.code.enabled,
			},
			llm: {
				model: env.RERANKER_LLM_MODEL ?? DEFAULT_TIER_CONFIGS.llm.model,
				maxCandidates: env.RERANKER_LLM_MAX_CANDIDATES ?? DEFAULT_TIER_CONFIGS.llm.maxCandidates,
				batchSize: DEFAULT_TIER_CONFIGS.llm.batchSize, // Always 1 for LLM
				enabled: env.RERANKER_LLM_ENABLED ?? DEFAULT_TIER_CONFIGS.llm.enabled,
			},
		},

		routing: {
			complexityThreshold:
				env.RERANKER_COMPLEXITY_THRESHOLD ?? DEFAULT_ROUTING_CONFIG.complexityThreshold,
			codePatternWeight:
				env.RERANKER_CODE_PATTERN_WEIGHT ?? DEFAULT_ROUTING_CONFIG.codePatternWeight,
			latencyBudgetDefault:
				env.RERANKER_LATENCY_BUDGET ?? DEFAULT_ROUTING_CONFIG.latencyBudgetDefault,
			codePatterns: DEFAULT_ROUTING_CONFIG.codePatterns,
			agenticPatterns: DEFAULT_ROUTING_CONFIG.agenticPatterns,
		},

		cache: {
			embeddingCacheMaxSize:
				env.RERANKER_EMBEDDING_CACHE_MAX_SIZE ?? DEFAULT_CACHE_CONFIG.embeddingCacheMaxSize,
			embeddingCacheTTLMs:
				env.RERANKER_EMBEDDING_CACHE_TTL_MS ?? DEFAULT_CACHE_CONFIG.embeddingCacheTTLMs,
			queryCacheTTLMs: env.RERANKER_QUERY_CACHE_TTL_MS ?? DEFAULT_CACHE_CONFIG.queryCacheTTLMs,
			queryCacheEnabled: env.RERANKER_CACHE_ENABLED,
		},

		rateLimit: {
			requestsPerHour:
				env.RERANKER_RATE_LIMIT_REQUESTS_PER_HOUR ?? DEFAULT_RATE_LIMIT_CONFIG.requestsPerHour,
			budgetLimit: env.RERANKER_RATE_LIMIT_BUDGET ?? DEFAULT_RATE_LIMIT_CONFIG.budgetLimit,
			costPerRequest:
				env.RERANKER_RATE_LIMIT_COST_PER_REQUEST ?? DEFAULT_RATE_LIMIT_CONFIG.costPerRequest,
		},

		abTesting: {
			enabled: env.RERANKER_AB_ENABLED,
			rolloutPercentage: env.RERANKER_AB_ROLLOUT,
		},
	};

	return config;
}

/**
 * Validate that required API keys are present for enabled tiers.
 *
 * @param config - Reranker configuration
 * @throws {Error} If required API keys are missing
 */
export function validateApiKeys(config: RerankerConfig): void {
	// Check if LLM tier is enabled and requires API key
	if (config.tiers.llm.enabled && !process.env.XAI_API_KEY) {
		throw new Error(
			"XAI_API_KEY environment variable is required when LLM reranker tier is enabled",
		);
	}
}

/**
 * Helper function to parse boolean from environment variable.
 *
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Parsed boolean value
 */
export function envBool(key: string, defaultValue: boolean): boolean {
	const val = process.env[key];
	if (val === undefined) return defaultValue;
	return val.toLowerCase() === "true" || val === "1";
}

/**
 * Helper function to parse number from environment variable.
 *
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Parsed number value
 */
export function envNum(key: string, defaultValue: number): number {
	const val = process.env[key];
	if (val === undefined) return defaultValue;
	const parsed = Number.parseInt(val, 10);
	return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Helper function to get string from environment variable.
 *
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns String value
 */
export function envStr(key: string, defaultValue: string): string {
	return process.env[key] ?? defaultValue;
}
