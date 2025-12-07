import { createSchema, createYoga } from "graphql-yoga";
import { resolvers, typeDefs } from "./schema";

const yoga = createYoga({
	schema: createSchema({
		typeDefs,
		resolvers,
	}),
	graphqlEndpoint: "/api/graphql",
	fetchAPI: { Response },
});

// biome-ignore lint/suspicious/noExplicitAny: Next.js Context type mismatch with Yoga
const handle = (req: Request, context: any) => yoga.handleRequest(req, context);

export { handle as GET, handle as POST };
