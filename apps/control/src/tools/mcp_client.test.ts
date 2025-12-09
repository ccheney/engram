import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpToolAdapter, MultiMcpAdapter } from "./mcp_client";

// Mock Client
const mockConnect = vi.fn(async () => {});
const mockListTools = vi.fn(async () => ({ tools: [{ name: "test-tool" }] }));
const mockCallTool = vi.fn(async () => ({ content: [] }));

mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: class {
		connect = mockConnect;
		listTools = mockListTools;
		callTool = mockCallTool;
	},
}));

// Mock Transport
mock.module("@modelcontextprotocol/sdk/client/stdio.js", () => ({
	StdioClientTransport: class {},
}));

// Mock Mastra
mock.module("@mastra/core/workflows", () => ({
	createStep: (obj: Record<string, unknown>) => ({ ...obj, _isStep: true }),
}));

describe("MCP Client", () => {
	beforeEach(() => {
		mockConnect.mockClear();
		mockListTools.mockClear();
		mockCallTool.mockClear();
	});

	describe("McpToolAdapter", () => {
		it("should connect and list tools", async () => {
			const adapter = new McpToolAdapter("echo");
			await adapter.connect();
			expect(mockConnect).toHaveBeenCalled();

			const tools = await adapter.listTools();
			expect(mockListTools).toHaveBeenCalled();
			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe("test-tool");
		});

		it("should create mastra step", async () => {
			const adapter = new McpToolAdapter("echo");
			const step = adapter.createMastraStep("test-tool");
			expect(step).toHaveProperty("id", "test-tool");
			expect(step).toHaveProperty("_isStep", true);

			// Test execution logic wrapper
			const executableStep = step as { execute: (opts: { context: unknown }) => Promise<unknown> };
			await executableStep.execute({ context: { arg: 1 } });
			expect(mockCallTool).toHaveBeenCalledWith({
				name: "test-tool",
				arguments: { arg: 1 },
			});
		});
	});

	describe("MultiMcpAdapter", () => {
		it("should aggregate tools from multiple adapters", async () => {
			const multi = new MultiMcpAdapter();
			const adapter1 = new McpToolAdapter("echo");
			const adapter2 = new McpToolAdapter("cat");

			multi.addAdapter(adapter1);
			multi.addAdapter(adapter2);

			await multi.connectAll();
			expect(mockConnect).toHaveBeenCalledTimes(2);

			// refreshTools is called in connectAll
			// listTools called for each adapter
			const tools = await multi.listTools();
			// Since mock returns same list for each instance
			expect(tools).toHaveLength(2); // 1 from each
		});

		it("should dispatch step creation to correct adapter", async () => {
			const multi = new MultiMcpAdapter();
			const adapter = new McpToolAdapter("echo");
			multi.addAdapter(adapter);
			await multi.connectAll(); // populate map

			const step = multi.createMastraStep("test-tool");
			expect(step.id).toBe("test-tool");
		});

		it("should throw if tool not found", () => {
			const multi = new MultiMcpAdapter();
			expect(() => multi.createMastraStep("missing")).toThrow("not found");
		});
	});
});
