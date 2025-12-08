import type { BlobStore, FalkorClient } from "@engram/storage";
import { now } from "./utils/time";

interface PruneResult {
	archived: number;
	deleted: number;
	archiveUri?: string;
}

export class GraphPruner {
	constructor(
		private client: FalkorClient,
		private archiveStore?: BlobStore,
	) {}

	/**
	 * Prune old transaction history.
	 * Optionally archives nodes to blob storage before deletion.
	 * Removes nodes where transaction time ended before the threshold.
	 *
	 * @param retentionMs - Milliseconds to keep history (default: 30 days)
	 * @returns PruneResult with counts and optional archive URI
	 */
	async pruneHistory(retentionMs = 30 * 24 * 60 * 60 * 1000): Promise<PruneResult> {
		const threshold = now() - retentionMs;

		// 1. Archive nodes before deletion (if archive store is configured)
		let archiveUri: string | undefined;
		let archivedCount = 0;

		if (this.archiveStore) {
			const archiveResult = await this.archiveNodes(threshold);
			archivedCount = archiveResult.count;
			archiveUri = archiveResult.uri;
		}

		// 2. Delete old nodes
		// Note: In FalkorDB/RedisGraph, bulk delete might be slow.
		// We should limit it or do it in batches.
		// For V1, a simple query is sufficient.
		const deleteQuery = `
			MATCH (n)
			WHERE n.tt_end < ${threshold}
			DELETE n
			RETURN count(n) as deleted_count
		`;

		const result = await this.client.query(deleteQuery);

		// Parse result (assuming standard RedisGraph response structure)
		const firstRow = result?.[0];
		const deletedCount = (firstRow?.deleted_count as number) ?? (firstRow?.[0] as number) ?? 0;

		return {
			archived: archivedCount,
			deleted: deletedCount,
			archiveUri,
		};
	}

	/**
	 * Archive nodes to JSONL format before deletion.
	 * Exports all nodes that will be pruned to blob storage.
	 */
	private async archiveNodes(threshold: number): Promise<{ count: number; uri?: string }> {
		// Query all nodes that will be deleted
		const fetchQuery = `
			MATCH (n)
			WHERE n.tt_end < ${threshold}
			RETURN labels(n) as labels, properties(n) as props, id(n) as nodeId
		`;

		const rows = await this.client.query<{
			labels: string[];
			props: Record<string, unknown>;
			nodeId: number;
		}>(fetchQuery);

		if (!rows || rows.length === 0) {
			return { count: 0 };
		}

		// Convert to JSONL format
		const lines: string[] = [];
		for (const row of rows) {
			const archiveRecord = {
				_archived_at: now(),
				_threshold: threshold,
				_node_id: row.nodeId,
				labels: row.labels,
				...row.props,
			};
			lines.push(JSON.stringify(archiveRecord));
		}

		const jsonlContent = lines.join("\n");

		// Save to blob storage
		const uri = await this.archiveStore!.save(jsonlContent);

		return {
			count: rows.length,
			uri,
		};
	}
}
