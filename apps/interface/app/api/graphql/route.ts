import { createSchema, createYoga } from "graphql-yoga";
import { resolvers, typeDefs } from "./schema";

const { handleRequest } = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

export { handleRequest as GET, handleRequest as POST };
