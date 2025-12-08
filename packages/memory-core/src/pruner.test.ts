import { describe, expect, it, mock, beforeEach } from "bun:test";
import { GraphPruner } from "./pruner";

describe("GraphPruner", () => {
	let mockFalkorQuery: ReturnType<typeof mock>;
	let mockFalkorClient: { query: ReturnType<typeof mock> };

	beforeEach(() => {
		mockFalkorQuery = mock(async () => [[5]]);
		mockFalkorClient = { query: mockFalkorQuery };
	});

	it("should prune history based on retention without archive", async () => {
		const pruner = new GraphPruner(mockFalkorClient as any);

		const result = await pruner.pruneHistory(1000);

		expect(mockFalkorQuery).toHaveBeenCalled();
		const call = mockFalkorQuery.mock.calls[mockFalkorQuery.mock.calls.length - 1];
		expect(call[0]).toContain("DELETE n");
		expect(result.deleted).toBe(5);
		expect(result.archived).toBe(0);
		expect(result.archiveUri).toBeUndefined();
	});

	it("should archive nodes before pruning when archiveStore is provided", async () => {
		const mockBlobStore = {
			save: mock(async () => "file:///data/blobs/abc123"),
			read: mock(async () => ""),
		};

		// First call: archive query returns nodes
		// Second call: delete query returns count
		mockFalkorQuery
			.mockResolvedValueOnce([
				{ labels: ["Thought"], props: { id: "t1", content: "old thought" }, nodeId: 1 },
				{ labels: ["Thought"], props: { id: "t2", content: "another old thought" }, nodeId: 2 },
			])
			.mockResolvedValueOnce([[2]]);

		const pruner = new GraphPruner(mockFalkorClient as any, mockBlobStore as any);

		const result = await pruner.pruneHistory(1000);

		expect(result.archived).toBe(2);
		expect(result.deleted).toBe(2);
		expect(result.archiveUri).toBe("file:///data/blobs/abc123");

		// Verify blob store was called with JSONL content
		expect(mockBlobStore.save).toHaveBeenCalledTimes(1);
		const savedContent = mockBlobStore.save.mock.calls[0][0] as string;
		const lines = savedContent.split("\n");
		expect(lines.length).toBe(2);

		// Verify JSONL format
		const firstRecord = JSON.parse(lines[0]);
		expect(firstRecord.labels).toEqual(["Thought"]);
		expect(firstRecord.id).toBe("t1");
		expect(firstRecord._node_id).toBe(1);
		expect(firstRecord._archived_at).toBeDefined();
	});

	it("should skip archive when no nodes to prune", async () => {
		const mockBlobStore = {
			save: mock(async () => "file:///data/blobs/abc123"),
			read: mock(async () => ""),
		};

		// Archive query returns empty, delete query returns 0
		mockFalkorQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([[0]]);

		const pruner = new GraphPruner(mockFalkorClient as any, mockBlobStore as any);

		const result = await pruner.pruneHistory(1000);

		expect(result.archived).toBe(0);
		expect(result.deleted).toBe(0);
		expect(result.archiveUri).toBeUndefined();

		// Blob store should not be called if no nodes to archive
		expect(mockBlobStore.save).not.toHaveBeenCalled();
	});
});
