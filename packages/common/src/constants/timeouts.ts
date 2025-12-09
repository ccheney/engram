/**
 * Timeout constants for the Engram system.
 *
 * All timeout values are in milliseconds unless otherwise noted.
 *
 * @module @engram/common/constants/timeouts
 */

/**
 * Graph database query timeouts.
 */
export const GraphTimeouts = {
	/** Default timeout for graph queries (10 seconds) */
	QUERY_MS: 10_000,

	/** Timeout for complex traversal queries (30 seconds) */
	TRAVERSAL_MS: 30_000,

	/** Timeout for graph connection attempts (5 seconds) */
	CONNECTION_MS: 5_000,

	/** Timeout for transaction commits (15 seconds) */
	TRANSACTION_MS: 15_000,
} as const;

/**
 * Tool and MCP execution timeouts.
 */
export const ToolTimeouts = {
	/** Default timeout for tool execution (60 seconds) */
	EXECUTION_MS: 60_000,

	/** Timeout for MCP server connection (10 seconds) */
	MCP_CONNECTION_MS: 10_000,

	/** Timeout for MCP tool invocation (120 seconds) */
	MCP_INVOCATION_MS: 120_000,

	/** Timeout for shell command execution (300 seconds / 5 minutes) */
	SHELL_EXECUTION_MS: 300_000,
} as const;

/**
 * Search and embedding timeouts.
 */
export const SearchTimeouts = {
	/** Default timeout for search queries (5 seconds) */
	QUERY_MS: 5_000,

	/** Timeout for embedding generation (30 seconds) */
	EMBEDDING_MS: 30_000,

	/** Timeout for reranking (500ms for fast tier) */
	RERANK_FAST_MS: 500,

	/** Timeout for reranking (2 seconds for accurate tier) */
	RERANK_ACCURATE_MS: 2_000,

	/** Timeout for LLM reranking (10 seconds) */
	RERANK_LLM_MS: 10_000,
} as const;

/**
 * HTTP and API timeouts.
 */
export const HttpTimeouts = {
	/** Default HTTP request timeout (30 seconds) */
	REQUEST_MS: 30_000,

	/** Timeout for health checks (5 seconds) */
	HEALTH_CHECK_MS: 5_000,

	/** Timeout for webhook deliveries (10 seconds) */
	WEBHOOK_MS: 10_000,

	/** WebSocket ping interval (30 seconds) */
	WS_PING_MS: 30_000,

	/** WebSocket connection timeout (10 seconds) */
	WS_CONNECTION_MS: 10_000,
} as const;

/**
 * Cache timeouts (TTL values).
 */
export const CacheTimeouts = {
	/** Default cache TTL (5 minutes) */
	DEFAULT_TTL_MS: 300_000,

	/** Short cache TTL (1 minute) */
	SHORT_TTL_MS: 60_000,

	/** Long cache TTL (1 hour) */
	LONG_TTL_MS: 3_600_000,

	/** Embedding cache TTL (24 hours) */
	EMBEDDING_TTL_MS: 86_400_000,

	/** Query result cache TTL (5 minutes) */
	QUERY_RESULT_TTL_MS: 300_000,
} as const;
