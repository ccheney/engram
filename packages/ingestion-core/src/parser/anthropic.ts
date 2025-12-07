import type { ParserStrategy, StreamDelta } from "./interface";

export class AnthropicParser implements ParserStrategy {
  parse(payload: unknown): StreamDelta | null {
    const p = payload as Record<string, unknown>;
    // Anthropic Event Types
    const type = p.type;

    if (type === "message_start") {
      const message = p.message as Record<string, unknown> | undefined;
      const usage = message?.usage as Record<string, unknown> | undefined;
      return {
        usage: {
          input: (usage?.input_tokens as number) || 0,
        },
      };
    }

    if (type === "content_block_start") {
      const contentBlock = p.content_block as Record<string, unknown> | undefined;
      if (contentBlock?.type === "tool_use") {
        return {
          toolCall: {
            index: p.index as number,
            id: contentBlock.id as string,
            name: contentBlock.name as string,
            args: "", // Start with empty args
          },
        };
      }
    }

    if (type === "content_block_delta") {
      const delta = p.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta") {
        return { content: delta.text as string };
      }
      if (delta?.type === "input_json_delta") {
        return {
          toolCall: {
            index: p.index as number,
            args: delta.partial_json as string,
          },
        };
      }
    }

    if (type === "message_delta") {
      const usage = p.usage as Record<string, unknown> | undefined;
      const delta = p.delta as Record<string, unknown> | undefined;
      const streamDelta: StreamDelta = {};

      if (usage?.output_tokens) {
        streamDelta.usage = { output: usage.output_tokens as number };
      }
      if (delta?.stop_reason) {
        streamDelta.stopReason = delta.stop_reason as string;
      }
      return Object.keys(streamDelta).length > 0 ? streamDelta : null;
    }

    return null;
  }
}
