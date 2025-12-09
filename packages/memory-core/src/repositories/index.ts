// =============================================================================
// Repository Interfaces
// =============================================================================

export type { SessionRepository } from "./session.repository";
export type { TurnRepository } from "./turn.repository";
export type { ReasoningRepository } from "./reasoning.repository";
export type { ToolCallRepository } from "./tool-call.repository";

// =============================================================================
// Repository Types (DTOs and Entities)
// =============================================================================

export type {
	// Session types
	CreateSessionInput,
	UpdateSessionInput,
	Session,
	// Turn types
	CreateTurnInput,
	UpdateTurnInput,
	Turn,
	// Reasoning types
	CreateReasoningInput,
	Reasoning,
	// ToolCall types
	CreateToolCallInput,
	ToolResult,
	ToolCall,
} from "./types";

export {
	CreateSessionInputSchema,
	UpdateSessionInputSchema,
	CreateTurnInputSchema,
	UpdateTurnInputSchema,
	CreateReasoningInputSchema,
	CreateToolCallInputSchema,
	ToolResultSchema,
} from "./types";

// =============================================================================
// FalkorDB Implementations
// =============================================================================

export { FalkorBaseRepository } from "./falkor-base";
export { FalkorSessionRepository } from "./falkor-session.repository";
export { FalkorTurnRepository } from "./falkor-turn.repository";
export { FalkorReasoningRepository } from "./falkor-reasoning.repository";
export { FalkorToolCallRepository } from "./falkor-tool-call.repository";
