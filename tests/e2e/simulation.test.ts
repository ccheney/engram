import { describe, expect, it, vi } from "vitest";
import { ContextAssembler } from "../../apps/control/src/context/assembler";
import { DecisionEngine } from "../../apps/control/src/engine/decision";
import { McpToolAdapter } from "../../apps/control/src/tools/mcp_client";
// Import directly from source to avoid resolution issues in test environment without build
import { ThinkingExtractor } from "../../packages/ingestion-core/src/index";

// Mocks
const mockMcp = new McpToolAdapter("echo", []);
mockMcp.connect = vi.fn(async () => {});
mockMcp.listTools = vi.fn(async () => [{ name: "read_file", description: "read", parameters: {} }]);
mockMcp.createMastraStep = vi.fn(
	(name) =>
		({
			id: name,
			execute: async ({ inputData }: { inputData: unknown }) => {
				console.log(`[MockExecution] Tool ${name} called with`, inputData);
				return { result: "success" };
			},
		}) as ReturnType<typeof mockMcp.createMastraStep>,
);

const mockFalkor = {
	connect: vi.fn(async () => {}),
	query: vi.fn(async () => []),
};

const mockSearch = {
	search: vi.fn(async () => []),
};

describe("System E2E Simulation", () => {
	it("should extract thinking tags correctly", () => {
		const extractor = new ThinkingExtractor();
		const input = "Hello <thinking>I need to process this</thinking> world";
		const delta = extractor.process(input);

		expect(delta.content).toBe("Hello  world");
		expect(delta.thought).toBe("I need to process this");
	});

	it("should initialize decision engine", async () => {
		const assembler = new ContextAssembler(
			mockSearch as Parameters<typeof ContextAssembler>[0],
			mockFalkor as Parameters<typeof ContextAssembler>[1],
		);

		const engine = new DecisionEngine(assembler, mockMcp);
		engine.start();

		// Just verify it starts without crashing
		expect(engine).toBeDefined();
	});
});
