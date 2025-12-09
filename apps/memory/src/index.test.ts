import { describe, expect, it, vi } from "vitest";

// Mock storage before importing the server
vi.mock("@engram/storage", () => ({
	createFalkorClient: () => ({
		connect: vi.fn(async () => {}),
		query: vi.fn(async () => []),
		disconnect: vi.fn(async () => {}),
	}),
	createKafkaClient: () => ({
		createConsumer: vi.fn(async () => ({
			subscribe: vi.fn(async () => {}),
			run: vi.fn(async () => {}),
		})),
		sendEvent: vi.fn(async () => {}),
	}),
	createRedisPublisher: () => ({
		publish: vi.fn(async () => {}),
	}),
}));

// Import server after mocks are set up
const { server } = await import("./index");

// Mock MCP
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
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
