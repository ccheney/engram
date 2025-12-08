import type { ParserStrategy, StreamDelta } from "./interface";

export class OpenAIParser implements ParserStrategy {
	parse(payload: unknown): StreamDelta | null {
		const p = payload as Record<string, unknown>;
		// OpenAI Structure: choices[0].delta or usage (final chunk)

		// Check for Usage (Stream Options)
		if (p.usage) {
			const usage = p.usage as Record<string, unknown>;
			return {
				usage: {
					input: usage.prompt_tokens as number,
					output: usage.completion_tokens as number,
				},
			};
		}

		const choices = p.choices as Array<Record<string, unknown>> | undefined;
		const choice = choices?.[0];
		if (!choice) return null;

		const delta = choice.delta as Record<string, unknown> | undefined;
		if (!delta) return null;

		const result: StreamDelta = {};

		if (delta.role) {
			result.role = delta.role as string;
		}

		// Content
		if (delta.content) {
			result.type = "content";
			result.content = delta.content as string;
		}

		// Tool Calls
		const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
		if (toolCalls && toolCalls.length > 0) {
			result.type = "tool_call";
			const toolCall = toolCalls[0];
			const functionCall = toolCall.function as Record<string, unknown> | undefined;
			result.toolCall = {
				index: toolCall.index as number,
				id: toolCall.id as string, // Only present in first chunk usually
				name: functionCall?.name as string, // Only present in first chunk usually
				args: functionCall?.arguments as string, // Partial JSON
			};
		}

		if (choice.finish_reason) {
			result.stopReason = choice.finish_reason as string;
		}

		return Object.keys(result).length > 0 ? result : null;
	}
}
