import { describe, expect, it, mock } from "bun:test";
import { SessionInitializer } from "./initializer";
import type { FalkorClient } from "@the-soul/storage";

describe("SessionInitializer", () => {
  it("should create a session if it does not exist", async () => {
    const mockQuery = mock((query: string, params: any) => {
        if (query.includes("MATCH")) return Promise.resolve([]); // Not found
        return Promise.resolve([['s']]); // Created
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
    const mockQuery = mock((query: string, params: any) => {
        return Promise.resolve([['existing']]); // Found
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
