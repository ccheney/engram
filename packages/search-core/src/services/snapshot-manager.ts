import { QdrantClient } from "@qdrant/js-client-rest";

export class SnapshotManager {
	private client: QdrantClient;
	private collectionName = "engram_memory";

	constructor(url: string = "http://localhost:6333") {
		this.client = new QdrantClient({ url });
	}

	/**
	 * Creates a snapshot of the memory collection.
	 * @returns The snapshot description (name, creation time, size).
	 */
	async createSnapshot() {
		const result = await this.client.createSnapshot(this.collectionName);
		return result;
	}

	/**
	 * Lists all available snapshots for the memory collection.
	 */
	async listSnapshots() {
		const result = await this.client.listSnapshots(this.collectionName);
		return result;
	}

	/**
	 * Recovers the collection from a snapshot.
	 * Note: This is a destructive operation for the current state if not handled carefully.
	 * Usually involves downloading and uploading or restoring from local file.
	 * For V1, we just expose create/list.
	 */
}
