/**
 * @engram/common - Shared utilities, errors, and constants for the Engram system.
 *
 * This package provides the foundation for all other packages and applications
 * in the Engram monorepo. It consolidates common patterns and eliminates
 * code duplication across the codebase.
 *
 * @example
 * ```ts
 * // Import utilities
 * import { envBool, sha256Hash, withRetry } from "@engram/common";
 *
 * // Import errors
 * import { GraphOperationError, ValidationError } from "@engram/common";
 *
 * // Import constants
 * import { GraphTimeouts, ContentLimits } from "@engram/common";
 *
 * // Or import from subpaths
 * import { envStr } from "@engram/common/utils";
 * import { EngramError } from "@engram/common/errors";
 * import { PruneIntervals } from "@engram/common/constants";
 * ```
 *
 * @module @engram/common
 */

// =============================================================================
// Utils
// =============================================================================

export {
	// Environment helpers
	envBool,
	envNum,
	envFloat,
	envStr,
	envRequired,
	envArray,
	// Hash utilities
	sha256Hash,
	sha256Short,
	hashObject,
	// Formatting utilities
	formatRelativeTime,
	truncateId,
	truncateText,
	formatBytes,
	formatDuration,
	// Retry utilities
	withRetry,
	RetryableErrors,
} from "./utils";

export type { RetryOptions } from "./utils";

// =============================================================================
// Errors
// =============================================================================

export {
	// Base error
	EngramError,
	// Error codes
	ErrorCodes,
	// Domain errors
	GraphOperationError,
	ParseError,
	ValidationError,
	ContextAssemblyError,
	RehydrationError,
	StorageError,
	SearchError,
} from "./errors";

export type { ErrorCode } from "./errors";

// =============================================================================
// Constants
// =============================================================================

export {
	// Timeouts
	GraphTimeouts,
	ToolTimeouts,
	SearchTimeouts,
	HttpTimeouts,
	CacheTimeouts,
	// Limits
	ContentLimits,
	QueryLimits,
	SessionLimits,
	RateLimits,
	BatchLimits,
	// Intervals
	PruneIntervals,
	PollIntervals,
	DebounceIntervals,
	RetentionPeriods,
	WebSocketIntervals,
} from "./constants";

// =============================================================================
// Testing
// =============================================================================
// NOTE: Testing utilities are NOT exported from the main entry point to avoid
// pulling vitest into production code. Import testing utilities from:
//   import { createTestGraphClient, ... } from "@engram/common/testing";
// =============================================================================
