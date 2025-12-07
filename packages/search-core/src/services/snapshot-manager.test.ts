import { describe, expect, it, mock } from "bun:test";
import { SnapshotManager } from "./snapshot-manager";

// Mock QdrantClient
mock.module("@qdrant/js-client-rest", () => {
    return {
        QdrantClient: class {
            constructor(_config: any) {}
            async createSnapshot(_collection: string) {
                return { name: "test-snapshot.snapshot", creation_time: "now" };
            }
            async listSnapshots(_collection: string) {
                return [{ name: "test-snapshot.snapshot", creation_time: "now" }];
            }
        }
    };
});

describe("SnapshotManager", () => {
    it("should create a snapshot", async () => {
        const manager = new SnapshotManager();
        const result = await manager.createSnapshot();
        expect(result).toEqual({ name: "test-snapshot.snapshot", creation_time: "now" });
    });

    it("should list snapshots", async () => {
        const manager = new SnapshotManager();
        const result = await manager.listSnapshots();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test-snapshot.snapshot");
    });
});
