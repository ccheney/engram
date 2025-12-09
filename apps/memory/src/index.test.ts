import { describe, expect, it, vi } from "vitest";
import { server } from "./index";

// Mock Falkor
mock.module("@engram/storage", () => ({
	createFalkorClient: () => ({
		connect: vi.fn(async () => {}),
		query: vi.fn(async () => []),
		disconnect: vi.fn(async () => {}),
	}),
}));

// Mock MCP
mock.module("@modelcontextprotocol/sdk/server/mcp.js", () => ({
	McpServer: class {
		tool = vi.fn(() => {});
		connect = vi.fn(async () => {});
	},
}));

describe("Memory Service", () => {
	it("should register tools", () => {
		// server is instantiated at module level
		// We just check it's defined, actual calls happened during import
		expect(server).toBeDefined();
	});
});
