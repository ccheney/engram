import { RawStreamEventSchema } from "@the-soul/events";
import {
  AnthropicParser,
  OpenAIParser,
  Redactor,
  type StreamDelta,
  ThinkingExtractor,
} from "@the-soul/ingestion-core";
import { createKafkaClient } from "@the-soul/storage";

const kafka = createKafkaClient("ingestion-service");
const redactor = new Redactor();
const anthropicParser = new AnthropicParser();
const openaiParser = new OpenAIParser();

// In-memory state for thinking extraction (per session)
// Note: In a production multi-instance setup, this should be replaced by
// processing raw events from Kafka in a stateful consumer, or using sticky sessions.
const extractors = new Map<string, ThinkingExtractor>();

// Simple Bun Server
const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") return new Response("OK");

    if (url.pathname === "/ingest" && req.method === "POST") {
      try {
        const body = await req.json();
        const rawEvent = RawStreamEventSchema.parse(body);
        const provider = rawEvent.provider;
        const sessionId = rawEvent.headers?.["x-session-id"] || rawEvent.event_id;

        // 1. Parse
        let delta: StreamDelta | null = null;
        if (provider === "anthropic") {
          delta = anthropicParser.parse(rawEvent.payload);
        } else if (provider === "openai") {
          delta = openaiParser.parse(rawEvent.payload);
        }

        if (!delta) {
          return new Response("Ignored event (no delta)", { status: 200 });
        }

        // 2. Extract Thinking (Stateful)
        if (delta.content) {
          let extractor = extractors.get(sessionId);
          if (!extractor) {
            extractor = new ThinkingExtractor();
            extractors.set(sessionId, extractor);
          }

          // Process content through extractor
          const extracted = extractor.process(delta.content);

          // Update delta with extracted content/thought
          delta.content = extracted.content;
          delta.thought = extracted.thought;

          // If both empty (buffered partial tag), we might send an empty event or skip?
          // Better to send empty update to keep alive?
          // If content became empty because it's all buffered, we should probably not redact/send empty content string.
        }

        // 3. Redact
        if (delta.content) {
          delta.content = redactor.redact(delta.content);
        }
        if (delta.thought) {
          delta.thought = redactor.redact(delta.thought);
        }

        // 4. Publish
        await kafka.sendEvent("parsed_events", sessionId, {
          ...delta,
          original_event_id: rawEvent.event_id,
          timestamp: rawEvent.ingest_timestamp,
        });

        return new Response(JSON.stringify({ status: "processed" }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e: unknown) {
        console.error(e);
        const message = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({ error: message }), { status: 400 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Ingestion Service running on port ${server.port}`);
