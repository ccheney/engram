/**
 * Configuration management for the Engram reranker system.
 *
 * This module provides comprehensive configuration management including:
 * - Type-safe configuration interfaces
 * - Environment variable loading with validation
 * - Runtime configuration updates with hot reload
 * - Schema validation using Zod
 * - Business logic validation
 *
 * Example usage:
 * ```ts
 * import { RuntimeConfig, validateComprehensive } from '@engram/search-core/config';
 *
 * // Get current configuration
 * const config = RuntimeConfig.get();
 *
 * // Update configuration at runtime
 * RuntimeConfig.update({ defaultTier: 'accurate' });
 *
 * // Watch for configuration changes
 * const unwatch = RuntimeConfig.watch((newConfig) => {
 *   console.log('Config updated:', newConfig);
 * });
 *
 * // Validate custom configuration
 * const result = validateComprehensive(customConfig);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */

// Core configuration types
export type {
	RerankerConfig,
	TierConfig,
	RoutingConfig,
	CacheConfig,
	RateLimitConfig,
	ABTestingConfig,
} from "./reranker-config";

// Default configurations
export {
	DEFAULT_RERANKER_CONFIG,
	DEFAULT_TIER_CONFIGS,
	DEFAULT_ROUTING_CONFIG,
	DEFAULT_CACHE_CONFIG,
	DEFAULT_RATE_LIMIT_CONFIG,
	DEFAULT_AB_TESTING_CONFIG,
} from "./reranker-config";

// Environment loading
export {
	loadConfigFromEnv,
	validateApiKeys,
	envBool,
	envNum,
	envStr,
} from "./env";

// Runtime configuration management
export { RuntimeConfig } from "./runtime-config";

// Validation utilities
export type { ValidationError, ValidationResult } from "./validation";
export {
	validateConfig,
	assertValidConfig,
	validateModelNames,
	validateBusinessLogic,
	validateComprehensive,
} from "./validation";
