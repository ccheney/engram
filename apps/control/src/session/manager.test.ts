import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "./manager";

// Mocks
const mockFalkor = {
	connect: vi.fn(async () => {}),
};

const mockAssembler = {
	assembleContext: vi.fn(async () => "context"),
};

const mockMcp = {
	listTools: vi.fn(async () => []),
};

// Mock DecisionEngine
const mockHandleInput = vi.fn(async () => {});
vi.mock("../engine/decision", () => ({
	DecisionEngine: class {
		start() {}
		handleInput = mockHandleInput;
	},
}));

// Mock Initializer
const mockEnsureSession = vi.fn(async () => {});
vi.mock("./initializer", () => ({
	SessionInitializer: class {
		ensureSession = mockEnsureSession;
	},
}));

describe("SessionManager", () => {
	it("should spawn engine and dispatch input", async () => {
		const manager = new SessionManager(mockAssembler as any, mockMcp as any, mockFalkor as any);
		const sessionId = "sess-1";
		const input = "Hello";

		await manager.handleInput(sessionId, input);

		expect(mockEnsureSession).toHaveBeenCalledWith(sessionId);
		expect(mockHandleInput).toHaveBeenCalledWith(sessionId, input);

		// Call again, should reuse engine
		await manager.handleInput(sessionId, "Again");
		expect(mockHandleInput).toHaveBeenCalledTimes(2);
	});
});
