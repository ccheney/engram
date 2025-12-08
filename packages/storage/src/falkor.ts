import { FalkorDB } from "falkordb";

export class FalkorClient {
	private dbPromise;
	private db: any;
	private graph: any;
	private graphName = "SoulGraph";

	constructor(url: string = "redis://localhost:6379") {
		const urlObj = new URL(url);
		// Store the promise or connection logic
		this.dbPromise = FalkorDB.connect({
			username: urlObj.username,
			password: urlObj.password,
			socket: {
				host: urlObj.hostname,
				port: Number(urlObj.port) || 6379,
			},
		});
	}

	async connect() {
		if (!this.db) {
			this.db = await this.dbPromise;
			this.graph = this.db.selectGraph(this.graphName);
		}
	}

	async query(cypher: string, params: Record<string, unknown> = {}): Promise<unknown> {
		if (!this.graph) await this.connect();
		const result = await this.graph.query(cypher, { params });
		return result.data;
	}

	async disconnect() {
		if (this.db) {
			await this.db.close();
		}
	}
}

export const createFalkorClient = () => {
	const url = process.env.FALKORDB_URL || "redis://localhost:6379";
	return new FalkorClient(url);
};
