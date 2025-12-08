import { z } from "zod";

// Re-export storage types for convenience (excluding node types that conflict with Zod schemas)
// Storage node types have different names to avoid conflict with Zod-inferred types
export type {
	BitemporalProperties,
	FalkorEdge,
	FalkorNode,
	FalkorResult,
	FalkorRow,
	QueryParam,
	QueryParams,
	SessionNode as FalkorSessionNode,
	SessionProperties,
	ThoughtNode as FalkorThoughtNode,
	ThoughtProperties,
	ToolCallNode as FalkorToolCallNode,
	ToolCallProperties,
} from "@engram/storage/falkor";

// =============================================================================
// Zod Schemas for validation
// =============================================================================

export const BitemporalSchema = z.object({
	vt_start: z.number(),
	vt_end: z.number(),
	tt_start: z.number(),
	tt_end: z.number(),
});

export const BaseNodeSchema = z
	.object({
		id: z.string().ulid(), // Unique Node ID
		labels: z.array(z.string()), // e.g., ['Thought', 'Session']
	})
	.merge(BitemporalSchema);

export type BaseNode = z.infer<typeof BaseNodeSchema>;
