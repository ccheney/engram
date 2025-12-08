import { apiError, apiSuccess } from "@lib/api-response";
import { createFalkorClient } from "@engram/storage/falkor";
import { z } from "zod";

const falkor = createFalkorClient();

export const _ReplayParams = z.object({
	sessionId: z.string(),
});

/**
 * Get linear session history (replay)
 * @pathParams ReplayParams
 */
export async function GET(_request: Request, props: { params: Promise<{ sessionId: string }> }) {
	try {
		const params = await props.params;
		const { sessionId } = params;
		if (!sessionId) {
			return apiError("Missing sessionId", "INVALID_REQUEST", 400);
		}

		await falkor.connect();

		// Query for linear history: Session -> Thought -> Thought ...
		// We capture Thoughts and any connected ToolCalls or observations roughly in order.
		// For now, let's stick to the 'get_session_history' logic: chain of Thoughts.
		const cypher = `
            MATCH (s:Session {id: $sessionId})-[:TRIGGERS]->(first:Thought)
            MATCH p = (first)-[:NEXT*0..100]->(t:Thought)
            RETURN t
            ORDER BY t.vt_start ASC
        `;

		// biome-ignore lint/suspicious/noExplicitAny: FalkorDB unknown return
		const result: any = await falkor.query(cypher, { sessionId });

		// Transform result: Falkor usually returns [[Node], [Node], ...] for this query
		// We want a flat array of objects
		const timeline = [];
		if (Array.isArray(result)) {
			for (const row of result) {
				const node = row[0];
				if (node && node.properties) {
					// Ensure we have an object
					timeline.push({ ...node.properties, id: node.properties.id || node.id });
				}
			}
		}

		return apiSuccess({ timeline });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return apiError(message, "REPLAY_QUERY_FAILED");
	}
}
