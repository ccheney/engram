import { describe, expect, it, vi } from "vitest";
import type { FalkorClient } from "@engram/storage";
import { SessionInitializer } from "./initializer";

describe("SessionInitializer", () => {
	it("should create a session if it does not exist", async () => {
		const mockQuery = vi.fn((query: string, _params: Record<string, unknown>) => {
			if (query.includes("MATCH")) return Promise.resolve([]); // Not found
			return Promise.resolve([["s"]]); // Created
		});

		const mockFalkor = {
			query: mockQuery,
		} as unknown as FalkorClient;

		const initializer = new SessionInitializer(mockFalkor);
		await initializer.ensureSession("session-123");

		expect(mockQuery).toHaveBeenCalledTimes(2);
		expect(mockQuery.mock.calls[1][0]).toContain("CREATE (s:Session");
	});

	it("should not create a session if it exists", async () => {
		const mockQuery = vi.fn((_query: string, _params: Record<string, unknown>) => {
			return Promise.resolve([["existing"]]); // Found
		});

		const mockFalkor = {
			query: mockQuery,
		} as unknown as FalkorClient;

		const initializer = new SessionInitializer(mockFalkor);
		await initializer.ensureSession("session-123");

		expect(mockQuery).toHaveBeenCalledTimes(1);
		expect(mockQuery.mock.calls[0][0]).toContain("MATCH");
	});
});
