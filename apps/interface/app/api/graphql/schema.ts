import { SearchRetriever } from "@engram/search-core";
import { createFalkorClient } from "@engram/storage/falkor";

const falkor = createFalkorClient();
const searchRetriever = new SearchRetriever();

export const typeDefs = `
  type Session {
    id: ID!
    title: String
    userId: String
    startedAt: Float
    thoughts(limit: Int): [Thought!]!
  }

  type Thought {
    id: ID!
    role: String
    content: String
    isThinking: Boolean
    validFrom: Float
    validTo: Float
    transactionStart: Float
    transactionEnd: Float
    causedBy: [ToolCall!]
  }

  type ToolCall {
    id: ID!
    name: String!
    arguments: String
    result: String
    validFrom: Float
    validTo: Float
  }

  type SearchResult {
    id: ID!
    content: String!
    score: Float!
    nodeId: String
    sessionId: String
    type: String
    timestamp: Float
  }

  scalar JSON

  type Query {
    session(id: ID!): Session
    sessions(limit: Int): [Session!]!
    search(query: String!, limit: Int, type: String): [SearchResult!]!
    graph(cypher: String!): JSON
  }
`;

interface SessionParent {
	id: string;
	[key: string]: unknown;
}

interface ThoughtParent {
	id: string;
	[key: string]: unknown;
}

interface SearchPayload {
	content?: string;
	node_id?: string;
	session_id?: string;
	type?: string;
	timestamp?: number;
}

export const resolvers = {
	Query: {
		session: async (_: unknown, { id }: { id: string }) => {
			await falkor.connect();
			const res = await falkor.query("MATCH (s:Session {id: $id}) RETURN s", { id });
			const row = res?.[0];
			const node = row?.s || row?.[0];
			if (!node) return null;
			return node;
		},
		sessions: async (_: unknown, { limit = 10 }: { limit: number }) => {
			await falkor.connect();
			const res = await falkor.query(
				`MATCH (s:Session) RETURN s ORDER BY s.startedAt DESC LIMIT ${limit}`,
			);
			return res || [];
		},
		search: async (
			_: unknown,
			{ query, limit = 10, type }: { query: string; limit?: number; type?: string },
		) => {
			const results = await searchRetriever.search({
				text: query,
				limit,
				filters: type ? { type: type as "thought" | "code" | "doc" } : undefined,
			});

			return (results || []).map((result) => {
				const payload = result.payload as SearchPayload;
				return {
					id: result.id,
					content: payload?.content || "",
					score: result.score,
					nodeId: payload?.node_id,
					sessionId: payload?.session_id,
					type: payload?.type,
					timestamp: payload?.timestamp,
				};
			});
		},
		graph: async (_: unknown, { cypher }: { cypher: string }) => {
			await falkor.connect();
			// Execute raw Cypher query - useful for ad-hoc exploration
			// Warning: This should be protected in production
			const res = await falkor.query(cypher);
			return res;
		},
	},
	Session: {
		thoughts: async (parent: SessionParent, { limit = 50 }: { limit: number }) => {
			await falkor.connect();
			// Traverse NEXT edge or TRIGGERS
			const res = await falkor.query(
				`MATCH (s:Session {id: $id})-[:TRIGGERS|NEXT*]->(t:Thought)
         RETURN t ORDER BY t.vt_start ASC LIMIT ${limit}`,
				{ id: parent.id },
			);
			return res || [];
		},
	},
	Thought: {
		causedBy: async (parent: ThoughtParent) => {
			await falkor.connect();
			// Fetch ToolCalls linked to this thought via YIELDS relationship
			const res = await falkor.query(
				`MATCH (t:Thought {id: $id})-[:YIELDS]->(tc:ToolCall)
         RETURN tc ORDER BY tc.vt_start ASC`,
				{ id: parent.id },
			);
			return res || [];
		},
	},
};
