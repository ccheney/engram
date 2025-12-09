/**
 * Error types for the Engram system.
 *
 * @module @engram/common/errors
 */

export { EngramError } from "./base";
export {
	ErrorCodes,
	GraphOperationError,
	ParseError,
	ValidationError,
	ContextAssemblyError,
	RehydrationError,
	StorageError,
	SearchError,
} from "./domain";
export type { ErrorCode } from "./domain";
