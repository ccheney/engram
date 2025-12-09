import { createLogger } from "@engram/logger";
import type { RerankerTier } from "@engram/search-core";
import { BatchedReranker, embeddingCacheHitRate, queryCacheHitRate } from "@engram/search-core";

const logger = createLogger({ component: "RerankerHealth" });

/**
 * Health check response for reranker status.
 *
 * Provides comprehensive monitoring of reranker tiers, circuit breaker state,
 * and cache performance.
 */
export interface RerankerHealthResponse {
	status: "healthy" | "degraded" | "unhealthy";
	models: {
		[tier: string]: {
			loaded: boolean;
			lastInferenceTime?: number;
			errorCountLast5Min: number;
		};
	};
	circuitBreaker: {
		state: "closed" | "open" | "half-open";
		failureCount: number;
	};
	cache: {
		embeddingCacheHitRate: number;
		queryCacheHitRate: number;
	};
}

/**
 * Error tracking for circuit breaker logic.
 * Tracks errors in a 5-minute sliding window.
 */
class ErrorTracker {
	private errors: Map<string, number[]> = new Map();
	private readonly windowMs = 5 * 60 * 1000; // 5 minutes

	/**
	 * Record an error for a tier.
	 */
	recordError(tier: string): void {
		const now = Date.now();
		const tierErrors = this.errors.get(tier) || [];
		tierErrors.push(now);
		this.errors.set(tier, tierErrors);
	}

	/**
	 * Get error count for a tier in the last 5 minutes.
	 */
	getErrorCount(tier: string): number {
		const now = Date.now();
		const tierErrors = this.errors.get(tier) || [];

		// Filter to only errors in the last 5 minutes
		const recentErrors = tierErrors.filter((timestamp) => now - timestamp < this.windowMs);

		// Update stored errors to only keep recent ones
		this.errors.set(tier, recentErrors);

		return recentErrors.length;
	}

	/**
	 * Clear errors for a tier.
	 */
	clearErrors(tier: string): void {
		this.errors.delete(tier);
	}
}

/**
 * Circuit breaker for reranker health monitoring.
 *
 * States:
 * - closed: Normal operation
 * - open: Too many errors, stop sending requests
 * - half-open: Testing if service has recovered
 */
class CircuitBreaker {
	private state: "closed" | "open" | "half-open" = "closed";
	private failureCount = 0;
	private readonly failureThreshold = 10; // Open after 10 failures
	private readonly resetTimeoutMs = 30 * 1000; // Try recovery after 30s
	private resetTimer?: NodeJS.Timeout;

	/**
	 * Record a successful operation.
	 * Resets failure count and closes circuit if in half-open state.
	 */
	recordSuccess(): void {
		this.failureCount = 0;
		if (this.state === "half-open") {
			this.state = "closed";
			logger.info({ msg: "Circuit breaker closed after successful recovery" });
		}
	}

	/**
	 * Record a failed operation.
	 * Opens circuit if threshold is exceeded.
	 */
	recordFailure(): void {
		this.failureCount++;

		if (this.failureCount >= this.failureThreshold && this.state === "closed") {
			this.state = "open";
			logger.warn({
				msg: "Circuit breaker opened due to failures",
				failureCount: this.failureCount,
			});

			// Schedule reset to half-open
			this.resetTimer = setTimeout(() => {
				this.state = "half-open";
				this.failureCount = 0;
				logger.info({ msg: "Circuit breaker moved to half-open state" });
			}, this.resetTimeoutMs);
		}
	}

	/**
	 * Get current circuit breaker state.
	 */
	getState(): { state: "closed" | "open" | "half-open"; failureCount: number } {
		return {
			state: this.state,
			failureCount: this.failureCount,
		};
	}

	/**
	 * Check if requests should be allowed.
	 */
	allowRequest(): boolean {
		return this.state !== "open";
	}

	/**
	 * Reset circuit breaker to closed state.
	 */
	reset(): void {
		this.state = "closed";
		this.failureCount = 0;
		if (this.resetTimer) {
			clearTimeout(this.resetTimer);
		}
	}
}

// Global instances
const errorTracker = new ErrorTracker();
const circuitBreaker = new CircuitBreaker();

/**
 * Record a reranker error for health monitoring.
 * Should be called when reranking operations fail.
 */
export function recordRerankError(tier: string): void {
	errorTracker.recordError(tier);
	circuitBreaker.recordFailure();
}

/**
 * Record a successful reranking operation.
 */
export function recordRerankSuccess(): void {
	circuitBreaker.recordSuccess();
}

/**
 * Get reranker health status.
 *
 * Checks:
 * - Model load status for each tier
 * - Recent error counts
 * - Circuit breaker state
 * - Cache hit rates
 *
 * @returns Health status response
 */
export async function getRerankerHealth(): Promise<RerankerHealthResponse> {
	// Get loaded models
	const loadedModels = BatchedReranker.getLoadedModels();
	const loadedModelKeys = new Set(loadedModels.map((m) => m.key));

	// Define tiers to check
	const tiers: RerankerTier[] = ["fast", "accurate", "code"];

	const modelsHealth: RerankerHealthResponse["models"] = {};

	for (const tier of tiers) {
		const reranker = BatchedReranker.forTier(tier);
		const modelKey = `${reranker.getModel()}:q8`;
		const isLoaded = loadedModelKeys.has(modelKey);

		// Get last inference time if model is loaded
		let lastInferenceTime: number | undefined;
		if (isLoaded) {
			const modelInfo = loadedModels.find((m) => m.key === modelKey);
			lastInferenceTime = modelInfo?.lastAccessTime;
		}

		// Get error count for this tier
		const errorCount = errorTracker.getErrorCount(tier);

		modelsHealth[tier] = {
			loaded: isLoaded,
			lastInferenceTime,
			errorCountLast5Min: errorCount,
		};
	}

	// Get circuit breaker state
	const cbState = circuitBreaker.getState();

	// Get cache hit rates from Prometheus metrics
	// Note: These are gauges that should be updated by cache operations
	const embeddingHitRate = (embeddingCacheHitRate as any).hashMap?.[""]?.value ?? 0;
	const queryHitRate = (queryCacheHitRate as any).hashMap?.[""]?.value ?? 0;

	// Determine overall health status
	let status: "healthy" | "degraded" | "unhealthy" = "healthy";

	// Unhealthy if circuit breaker is open
	if (cbState.state === "open") {
		status = "unhealthy";
	}
	// Degraded if any tier has high error count or circuit breaker is half-open
	else if (
		cbState.state === "half-open" ||
		Object.values(modelsHealth).some((m) => m.errorCountLast5Min > 5)
	) {
		status = "degraded";
	}

	return {
		status,
		models: modelsHealth,
		circuitBreaker: cbState,
		cache: {
			embeddingCacheHitRate: embeddingHitRate,
			queryCacheHitRate: queryHitRate,
		},
	};
}

/**
 * HTTP handler for reranker health check endpoint.
 * GET /health/reranker
 */
export async function handleRerankerHealth(): Promise<{
	statusCode: number;
	body: RerankerHealthResponse;
}> {
	try {
		const health = await getRerankerHealth();

		// Return 200 for healthy, 503 for degraded/unhealthy
		const statusCode = health.status === "healthy" ? 200 : 503;

		return {
			statusCode,
			body: health,
		};
	} catch (error) {
		logger.error({
			msg: "Failed to get reranker health",
			error: error instanceof Error ? error.message : String(error),
		});

		// Return unhealthy status on error
		return {
			statusCode: 503,
			body: {
				status: "unhealthy",
				models: {},
				circuitBreaker: {
					state: "open",
					failureCount: 0,
				},
				cache: {
					embeddingCacheHitRate: 0,
					queryCacheHitRate: 0,
				},
			},
		};
	}
}
