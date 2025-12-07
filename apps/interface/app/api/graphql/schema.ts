import { createFalkorClient } from "@the-soul/storage";

const falkor = createFalkorClient();

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
  }

  type Query {
    session(id: ID!): Session
    sessions(limit: Int): [Session!]!
    search(query: String!): [Thought!]
  }
`;

export const resolvers = {
  Query: {
    session: async (_: unknown, { id }: { id: string }) => {
      await falkor.connect();
      const res = await falkor.query("MATCH (s:Session {id: $id}) RETURN s", { id });
      // Parse FalkorDB response (simplified mock parsing as raw response is complex)
      // Assuming we map it:
      // biome-ignore lint/suspicious/noExplicitAny: FalkorDB raw response type unknown
      const node = (res as any)?.[0]?.[0];
      if (!node) return null;
      return node; // Properties map
    },
    sessions: async (_: unknown, { limit = 10 }: { limit: number }) => {
      await falkor.connect();
      const res = await falkor.query(
        `MATCH (s:Session) RETURN s ORDER BY s.startedAt DESC LIMIT ${limit}`,
      );
      // biome-ignore lint/suspicious/noExplicitAny: FalkorDB raw response type unknown
      return (res as any) || [];
    },
  },
  Session: {
    // biome-ignore lint/suspicious/noExplicitAny: GraphQL parent resolver is loosely typed
    thoughts: async (parent: any, { limit = 50 }: { limit: number }) => {
      await falkor.connect();
      // Traverse NEXT edge or TRIGGERS
      const res = await falkor.query(
        `MATCH (s:Session {id: $id})-[:TRIGGERS|NEXT*]->(t:Thought)
         RETURN t ORDER BY t.vt_start ASC LIMIT ${limit}`,
        { id: parent.id },
      );
      // biome-ignore lint/suspicious/noExplicitAny: FalkorDB raw response type unknown
      return (res as any) || [];
    },
  },
};
