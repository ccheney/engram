import type { ParsedStreamEvent } from "@engram/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentEventHandler } from "./content.handler";
import { ControlEventHandler } from "./control.handler";
import { DiffEventHandler } from "./diff.handler";
import type { HandlerContext, TurnState } from "./handler.interface";
import { createDefaultHandlerRegistry, EventHandlerRegistry } from "./registry";
import { ThoughtEventHandler } from "./thought.handler";
import { ToolCallEventHandler } from "./tool-call.handler";
import { UsageEventHandler } from "./usage.handler";

// Mock graph client
const mockGraphClient = {
	connect: vi.fn().mockResolvedValue(undefined),
	disconnect: vi.fn().mockResolvedValue(undefined),
	query: vi.fn().mockResolvedValue([]),
	isConnected: vi.fn().mockReturnValue(true),
};

// Mock logger
const mockLogger = {
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
};

// Helper to create test context
function createTestContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
	return {
		sessionId: "test-session-123",
		turnId: "test-turn-456",
		graphClient: mockGraphClient,
		logger: mockLogger as unknown as HandlerContext["logger"],
		emitNodeCreated: vi.fn(),
		...overrides,
	};
}

// Helper to create test turn state
function createTestTurnState(overrides: Partial<TurnState> = {}): TurnState {
	return {
		turnId: "test-turn-456",
		sessionId: "test-session-123",
		userContent: "Test user message",
		assistantContent: "",
		reasoningBlocks: [],
		toolCalls: [],
		filesTouched: new Map(),
		pendingReasoningIds: [],
		toolCallsCount: 0,
		contentBlockIndex: 0,
		inputTokens: 0,
		outputTokens: 0,
		sequenceIndex: 0,
		createdAt: Date.now(),
		isFinalized: false,
		...overrides,
	};
}

// Helper to create test events
function createTestEvent(overrides: Partial<ParsedStreamEvent>): ParsedStreamEvent {
	return {
		event_id: "evt-123",
		original_event_id: "orig-123",
		timestamp: new Date().toISOString(),
		type: "content",
		...overrides,
	} as ParsedStreamEvent;
}

describe("EventHandlerRegistry", () => {
	let registry: EventHandlerRegistry;

	beforeEach(() => {
		registry = new EventHandlerRegistry();
	});

	it("should register handlers", () => {
		const handler = new ContentEventHandler();
		registry.register(handler);
		expect(registry.handlerCount).toBe(1);
	});

	it("should find handler for matching event", () => {
		registry.register(new ContentEventHandler());
		const event = createTestEvent({
			type: "content",
			role: "assistant",
			content: "Hello",
		});
		const handler = registry.getHandler(event);
		expect(handler).toBeDefined();
		expect(handler?.eventType).toBe("content");
	});

	it("should return undefined for unhandled event types", () => {
		registry.register(new ContentEventHandler());
		const event = createTestEvent({
			type: "thought",
			thought: "Thinking...",
		});
		const handler = registry.getHandler(event);
		expect(handler).toBeUndefined();
	});

	it("should return all matching handlers", () => {
		registry.register(new ContentEventHandler());
		registry.register(new ThoughtEventHandler());
		const event = createTestEvent({
			type: "content",
			role: "assistant",
			content: "Hello",
		});
		const handlers = registry.getHandlers(event);
		expect(handlers.length).toBe(1);
	});

	it("should track event types", () => {
		registry.register(new ContentEventHandler());
		registry.register(new ThoughtEventHandler());
		registry.register(new UsageEventHandler());
		expect(registry.eventTypes).toContain("content");
		expect(registry.eventTypes).toContain("thought");
		expect(registry.eventTypes).toContain("usage");
	});
});

describe("createDefaultHandlerRegistry", () => {
	it("should create registry with all default handlers", () => {
		const registry = createDefaultHandlerRegistry();
		expect(registry.handlerCount).toBe(6);
		expect(registry.eventTypes).toEqual(
			expect.arrayContaining(["content", "thought", "tool_call", "diff", "usage", "control"]),
		);
	});
});

describe("ContentEventHandler", () => {
	let handler: ContentEventHandler;
	let context: HandlerContext;
	let turn: TurnState;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new ContentEventHandler();
		context = createTestContext();
		turn = createTestTurnState();
	});

	it("should handle assistant content events", () => {
		const event = createTestEvent({
			type: "content",
			role: "assistant",
			content: "Hello",
		});
		expect(handler.canHandle(event)).toBe(true);
	});

	it("should not handle user content events", () => {
		const event = createTestEvent({
			type: "content",
			role: "user",
			content: "Hello",
		});
		expect(handler.canHandle(event)).toBe(false);
	});

	it("should accumulate content into turn state", async () => {
		const event = createTestEvent({
			type: "content",
			role: "assistant",
			content: "Hello world",
		});

		const result = await handler.handle(event, turn, context);

		expect(result.handled).toBe(true);
		expect(result.action).toBe("content_accumulated");
		expect(turn.assistantContent).toBe("Hello world");
		expect(turn.contentBlockIndex).toBe(1);
	});

	it("should update preview periodically", async () => {
		// Build up content to trigger preview update at 500 chars
		turn.assistantContent = "x".repeat(499);

		const event = createTestEvent({
			type: "content",
			role: "assistant",
			content: "x", // This will make it exactly 500 chars
		});

		await handler.handle(event, turn, context);

		expect(mockGraphClient.query).toHaveBeenCalled();
	});
});

describe("ThoughtEventHandler", () => {
	let handler: ThoughtEventHandler;
	let context: HandlerContext;
	let turn: TurnState;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new ThoughtEventHandler();
		context = createTestContext();
		turn = createTestTurnState();
	});

	it("should handle thought events", () => {
		const event = createTestEvent({
			type: "thought",
			thought: "Let me think about this...",
		});
		expect(handler.canHandle(event)).toBe(true);
	});

	it("should not handle non-thought events", () => {
		const event = createTestEvent({
			type: "content",
			content: "Hello",
		});
		expect(handler.canHandle(event)).toBe(false);
	});

	it("should create reasoning node and update turn state", async () => {
		const event = createTestEvent({
			type: "thought",
			thought: "Let me think about this problem...",
		});

		const result = await handler.handle(event, turn, context);

		expect(result.handled).toBe(true);
		expect(result.action).toBe("reasoning_created");
		expect(result.nodeId).toBeDefined();
		expect(turn.reasoningBlocks.length).toBe(1);
		expect(turn.pendingReasoningIds.length).toBe(1);
		expect(turn.contentBlockIndex).toBe(1);
		expect(mockGraphClient.query).toHaveBeenCalled();
	});

	it("should emit node created event", async () => {
		const event = createTestEvent({
			type: "thought",
			thought: "Thinking...",
		});

		await handler.handle(event, turn, context);

		expect(context.emitNodeCreated).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "reasoning",
				label: "Reasoning",
			}),
		);
	});
});

describe("ToolCallEventHandler", () => {
	let handler: ToolCallEventHandler;
	let context: HandlerContext;
	let turn: TurnState;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new ToolCallEventHandler();
		context = createTestContext();
		turn = createTestTurnState();
	});

	it("should handle tool call events", () => {
		const event = createTestEvent({
			type: "tool_call",
			tool_call: {
				id: "call_123",
				name: "Read",
				arguments_delta: '{"file_path": "/test/file.ts"}',
				index: 0,
			},
		});
		expect(handler.canHandle(event)).toBe(true);
	});

	it("should create tool call node", async () => {
		const event = createTestEvent({
			type: "tool_call",
			tool_call: {
				id: "call_123",
				name: "Read",
				arguments_delta: '{"file_path": "/test/file.ts"}',
				index: 0,
			},
		});

		const result = await handler.handle(event, turn, context);

		expect(result.handled).toBe(true);
		expect(result.action).toBe("toolcall_created");
		expect(turn.toolCalls.length).toBe(1);
		expect(turn.toolCallsCount).toBe(1);
		expect(mockGraphClient.query).toHaveBeenCalled();
	});

	it("should link pending reasoning blocks to tool call", async () => {
		// Set up pending reasoning
		turn.pendingReasoningIds = ["reasoning-1", "reasoning-2"];
		turn.reasoningBlocks = [
			{ id: "reasoning-1", sequenceIndex: 0, content: "First thought" },
			{ id: "reasoning-2", sequenceIndex: 1, content: "Second thought" },
		];

		const event = createTestEvent({
			type: "tool_call",
			tool_call: {
				id: "call_123",
				name: "Bash",
				arguments_delta: '{"command": "ls"}',
				index: 0,
			},
		});

		await handler.handle(event, turn, context);

		// Should create TRIGGERS edges
		expect(mockGraphClient.query).toHaveBeenCalledWith(
			expect.stringContaining("TRIGGERS"),
			expect.objectContaining({
				reasoningIds: ["reasoning-1", "reasoning-2"],
			}),
		);

		// Should clear pending reasoning IDs
		expect(turn.pendingReasoningIds.length).toBe(0);
	});

	it("should extract file path for file operations", async () => {
		const event = createTestEvent({
			type: "tool_call",
			tool_call: {
				id: "call_123",
				name: "Read",
				arguments_delta: '{"file_path": "/src/index.ts"}',
				index: 0,
			},
		});

		await handler.handle(event, turn, context);

		expect(turn.toolCalls[0].filePath).toBe("/src/index.ts");
		expect(turn.toolCalls[0].fileAction).toBe("read");
		expect(turn.filesTouched.has("/src/index.ts")).toBe(true);
	});

	it("should infer correct tool types", async () => {
		const testCases = [
			{ name: "Read", expectedType: "file_read" },
			{ name: "Write", expectedType: "file_write" },
			{ name: "Edit", expectedType: "file_edit" },
			{ name: "Bash", expectedType: "bash_exec" },
			{ name: "Glob", expectedType: "file_glob" },
			{ name: "Grep", expectedType: "file_grep" },
			{ name: "mcp__chrome__click", expectedType: "mcp" },
		];

		for (const { name, expectedType } of testCases) {
			turn = createTestTurnState();
			const event = createTestEvent({
				type: "tool_call",
				tool_call: {
					id: `call_${name}`,
					name,
					arguments_delta: "{}",
					index: 0,
				},
			});

			await handler.handle(event, turn, context);

			expect(turn.toolCalls[0].toolType).toBe(expectedType);
		}
	});
});

describe("DiffEventHandler", () => {
	let handler: DiffEventHandler;
	let context: HandlerContext;
	let turn: TurnState;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new DiffEventHandler();
		context = createTestContext();
		turn = createTestTurnState();
	});

	it("should handle diff events with file", () => {
		const event = createTestEvent({
			type: "diff",
			diff: {
				file: "/src/index.ts",
				hunk: "@@ -1,3 +1,4 @@",
			},
		});
		expect(handler.canHandle(event)).toBe(true);
	});

	it("should not handle diff events without file", () => {
		const event = createTestEvent({
			type: "diff",
			diff: {
				hunk: "@@ -1,3 +1,4 @@",
			},
		});
		expect(handler.canHandle(event)).toBe(false);
	});

	it("should update recent tool call with file info", async () => {
		// Set up a recent tool call without file path
		turn.toolCalls = [
			{
				id: "toolcall-1",
				callId: "call_123",
				toolName: "Edit",
				toolType: "file_edit",
				argumentsJson: "{}",
				sequenceIndex: 0,
				triggeringReasoningIds: [],
			},
		];

		const event = createTestEvent({
			type: "diff",
			diff: {
				file: "/src/component.tsx",
				hunk: "@@ -10,5 +10,7 @@\n+new line",
			},
		});

		await handler.handle(event, turn, context);

		expect(turn.toolCalls[0].filePath).toBe("/src/component.tsx");
		expect(turn.toolCalls[0].fileAction).toBe("edit");
		expect(mockGraphClient.query).toHaveBeenCalled();
	});

	it("should track files touched at turn level", async () => {
		const event = createTestEvent({
			type: "diff",
			diff: {
				file: "/src/new-file.ts",
				hunk: "@@ -0,0 +1,10 @@",
			},
		});

		await handler.handle(event, turn, context);

		expect(turn.filesTouched.has("/src/new-file.ts")).toBe(true);
		expect(turn.filesTouched.get("/src/new-file.ts")?.action).toBe("edit");
	});
});

describe("UsageEventHandler", () => {
	let handler: UsageEventHandler;
	let context: HandlerContext;
	let turn: TurnState;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new UsageEventHandler();
		context = createTestContext();
		turn = createTestTurnState();
	});

	it("should handle usage events", () => {
		const event = createTestEvent({
			type: "usage",
			usage: {
				input_tokens: 100,
				output_tokens: 200,
			},
		});
		expect(handler.canHandle(event)).toBe(true);
	});

	it("should update token counts and finalize turn", async () => {
		turn.assistantContent = "Some response content";

		const event = createTestEvent({
			type: "usage",
			usage: {
				input_tokens: 150,
				output_tokens: 300,
			},
		});

		const result = await handler.handle(event, turn, context);

		expect(result.handled).toBe(true);
		expect(result.action).toBe("turn_finalized");
		expect(turn.inputTokens).toBe(150);
		expect(turn.outputTokens).toBe(300);
		expect(turn.isFinalized).toBe(true);
		expect(mockGraphClient.query).toHaveBeenCalled();
	});

	it("should not finalize already finalized turn", async () => {
		turn.isFinalized = true;

		const event = createTestEvent({
			type: "usage",
			usage: {
				input_tokens: 100,
				output_tokens: 200,
			},
		});

		await handler.handle(event, turn, context);

		// Query should not be called for finalization
		expect(mockGraphClient.query).not.toHaveBeenCalled();
	});
});

describe("ControlEventHandler", () => {
	let handler: ControlEventHandler;
	let context: HandlerContext;
	let turn: TurnState;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new ControlEventHandler();
		context = createTestContext();
		turn = createTestTurnState();
	});

	it("should handle control events", () => {
		const event = createTestEvent({
			type: "control",
		});
		expect(handler.canHandle(event)).toBe(true);
	});

	it("should acknowledge control events", async () => {
		const event = createTestEvent({
			type: "control",
		});

		const result = await handler.handle(event, turn, context);

		expect(result.handled).toBe(true);
		expect(result.action).toBe("control_acknowledged");
		expect(mockLogger.debug).toHaveBeenCalled();
	});
});
