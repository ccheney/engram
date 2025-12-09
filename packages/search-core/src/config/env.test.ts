import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { envBool, envNum, envStr, loadConfigFromEnv, validateApiKeys } from "./env";
import { DEFAULT_TIER_CONFIGS } from "./reranker-config";

describe("env", () => {
	// Store original env
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Clear relevant env vars before each test
		delete process.env.RERANKER_ENABLED;
		delete process.env.RERANKER_DEFAULT_TIER;
		delete process.env.RERANKER_TIMEOUT_MS;
		delete process.env.RERANKER_FAST_MODEL;
		delete process.env.RERANKER_CACHE_ENABLED;
		delete process.env.RERANKER_AB_ROLLOUT;
		delete process.env.XAI_API_KEY;
	});

	afterEach(() => {
		// Restore original env
		process.env = { ...originalEnv };
	});

	describe("envBool", () => {
		test("should return default when env var not set", () => {
			expect(envBool("NONEXISTENT_VAR", true)).toBe(true);
			expect(envBool("NONEXISTENT_VAR", false)).toBe(false);
		});

		test("should parse 'true' as true", () => {
			process.env.TEST_BOOL = "true";
			expect(envBool("TEST_BOOL", false)).toBe(true);
		});

		test("should parse 'TRUE' as true (case insensitive)", () => {
			process.env.TEST_BOOL = "TRUE";
			expect(envBool("TEST_BOOL", false)).toBe(true);
		});

		test("should parse '1' as true", () => {
			process.env.TEST_BOOL = "1";
			expect(envBool("TEST_BOOL", false)).toBe(true);
		});

		test("should parse 'false' as false", () => {
			process.env.TEST_BOOL = "false";
			expect(envBool("TEST_BOOL", true)).toBe(false);
		});

		test("should parse '0' as false", () => {
			process.env.TEST_BOOL = "0";
			expect(envBool("TEST_BOOL", true)).toBe(false);
		});
	});

	describe("envNum", () => {
		test("should return default when env var not set", () => {
			expect(envNum("NONEXISTENT_VAR", 42)).toBe(42);
		});

		test("should parse valid integer", () => {
			process.env.TEST_NUM = "123";
			expect(envNum("TEST_NUM", 0)).toBe(123);
		});

		test("should parse negative integer", () => {
			process.env.TEST_NUM = "-456";
			expect(envNum("TEST_NUM", 0)).toBe(-456);
		});

		test("should return default for invalid number", () => {
			process.env.TEST_NUM = "not_a_number";
			expect(envNum("TEST_NUM", 42)).toBe(42);
		});

		test("should return default for empty string", () => {
			process.env.TEST_NUM = "";
			expect(envNum("TEST_NUM", 42)).toBe(42);
		});
	});

	describe("envStr", () => {
		test("should return default when env var not set", () => {
			expect(envStr("NONEXISTENT_VAR", "default")).toBe("default");
		});

		test("should return env var value when set", () => {
			process.env.TEST_STR = "hello world";
			expect(envStr("TEST_STR", "default")).toBe("hello world");
		});

		test("should return empty string if env var is empty", () => {
			process.env.TEST_STR = "";
			expect(envStr("TEST_STR", "default")).toBe("");
		});
	});

	describe("loadConfigFromEnv", () => {
		test("should load default config when no env vars set", () => {
			const config = loadConfigFromEnv();

			expect(config.enabled).toBe(true);
			expect(config.defaultTier).toBe("fast");
			expect(config.timeoutMs).toBe(500);
		});

		test("should override global settings from env", () => {
			process.env.RERANKER_ENABLED = "false";
			process.env.RERANKER_DEFAULT_TIER = "accurate";
			process.env.RERANKER_TIMEOUT_MS = "1000";

			const config = loadConfigFromEnv();

			expect(config.enabled).toBe(false);
			expect(config.defaultTier).toBe("accurate");
			expect(config.timeoutMs).toBe(1000);
		});

		test("should override tier-specific settings from env", () => {
			process.env.RERANKER_FAST_MODEL = "custom/fast-model";
			process.env.RERANKER_FAST_MAX_CANDIDATES = "100";
			process.env.RERANKER_FAST_BATCH_SIZE = "32";
			process.env.RERANKER_FAST_ENABLED = "false";

			const config = loadConfigFromEnv();

			expect(config.tiers.fast.model).toBe("custom/fast-model");
			expect(config.tiers.fast.maxCandidates).toBe(100);
			expect(config.tiers.fast.batchSize).toBe(32);
			expect(config.tiers.fast.enabled).toBe(false);
		});

		test("should override routing settings from env", () => {
			process.env.RERANKER_COMPLEXITY_THRESHOLD = "75";
			process.env.RERANKER_CODE_PATTERN_WEIGHT = "0.9";
			process.env.RERANKER_LATENCY_BUDGET = "1000";

			const config = loadConfigFromEnv();

			expect(config.routing.complexityThreshold).toBe(75);
			expect(config.routing.codePatternWeight).toBe(0.9);
			expect(config.routing.latencyBudgetDefault).toBe(1000);
		});

		test("should override cache settings from env", () => {
			process.env.RERANKER_CACHE_ENABLED = "false";
			process.env.RERANKER_EMBEDDING_CACHE_MAX_SIZE = "5000";
			process.env.RERANKER_EMBEDDING_CACHE_TTL_MS = "7200000";
			process.env.RERANKER_QUERY_CACHE_TTL_MS = "600000";

			const config = loadConfigFromEnv();

			expect(config.cache.queryCacheEnabled).toBe(false);
			expect(config.cache.embeddingCacheMaxSize).toBe(5000);
			expect(config.cache.embeddingCacheTTLMs).toBe(7200000);
			expect(config.cache.queryCacheTTLMs).toBe(600000);
		});

		test("should override rate limit settings from env", () => {
			process.env.RERANKER_RATE_LIMIT_REQUESTS_PER_HOUR = "200";
			process.env.RERANKER_RATE_LIMIT_BUDGET = "2000";
			process.env.RERANKER_RATE_LIMIT_COST_PER_REQUEST = "10";

			const config = loadConfigFromEnv();

			expect(config.rateLimit.requestsPerHour).toBe(200);
			expect(config.rateLimit.budgetLimit).toBe(2000);
			expect(config.rateLimit.costPerRequest).toBe(10);
		});

		test("should override A/B testing settings from env", () => {
			process.env.RERANKER_AB_ENABLED = "true";
			process.env.RERANKER_AB_ROLLOUT = "50";

			const config = loadConfigFromEnv();

			expect(config.abTesting.enabled).toBe(true);
			expect(config.abTesting.rolloutPercentage).toBe(50);
		});

		test("should use defaults for LLM tier when not overridden", () => {
			const config = loadConfigFromEnv();

			expect(config.tiers.llm.model).toBe(DEFAULT_TIER_CONFIGS.llm.model);
			expect(config.tiers.llm.maxCandidates).toBe(DEFAULT_TIER_CONFIGS.llm.maxCandidates);
			expect(config.tiers.llm.batchSize).toBe(1); // Always 1 for LLM
		});

		test("should preserve regex patterns from defaults", () => {
			const config = loadConfigFromEnv();

			expect(config.routing.codePatterns).toBeInstanceOf(Array);
			expect(config.routing.codePatterns[0]).toBeInstanceOf(RegExp);
			expect(config.routing.agenticPatterns).toBeInstanceOf(Array);
			expect(config.routing.agenticPatterns[0]).toBeInstanceOf(RegExp);
		});

		test("should handle invalid enum values gracefully", () => {
			process.env.RERANKER_DEFAULT_TIER = "invalid_tier";

			// Should throw validation error from zod
			expect(() => loadConfigFromEnv()).toThrow();
		});

		test("should handle invalid number values gracefully", () => {
			process.env.RERANKER_TIMEOUT_MS = "not_a_number";

			// Should throw validation error from zod
			expect(() => loadConfigFromEnv()).toThrow();
		});

		test("should handle negative numbers gracefully", () => {
			process.env.RERANKER_TIMEOUT_MS = "-100";

			// Should throw validation error from zod (must be positive)
			expect(() => loadConfigFromEnv()).toThrow();
		});
	});

	describe("validateApiKeys", () => {
		test("should not throw when LLM tier is disabled", () => {
			const config = loadConfigFromEnv();
			config.tiers.llm.enabled = false;

			expect(() => validateApiKeys(config)).not.toThrow();
		});

		test("should throw when LLM tier is enabled and XAI_API_KEY is missing", () => {
			const config = loadConfigFromEnv();
			config.tiers.llm.enabled = true;

			expect(() => validateApiKeys(config)).toThrow("XAI_API_KEY environment variable is required");
		});

		test("should not throw when LLM tier is enabled and XAI_API_KEY is set", () => {
			process.env.XAI_API_KEY = "test-api-key";

			const config = loadConfigFromEnv();
			config.tiers.llm.enabled = true;

			expect(() => validateApiKeys(config)).not.toThrow();
		});

		test("should not throw when reranking is globally disabled", () => {
			const config = loadConfigFromEnv();
			config.enabled = false;
			config.tiers.llm.enabled = true;

			// API key validation should still check if tier is enabled
			expect(() => validateApiKeys(config)).toThrow();
		});
	});
});
