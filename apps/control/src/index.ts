import { createKafkaClient } from "@the-soul/storage";
import { ContextAssembler } from "./context/assembler";
import { DecisionEngine } from "./engine/decision";
import { McpToolAdapter } from "./tools/mcp_client";

// Initialize Services
const kafka = createKafkaClient("control-service");

// Initialize MCP Adapter
// For V1 scaffold: We'll spawn 'bun run apps/execution/src/index.ts' if local.
const mcpAdapter = new McpToolAdapter("bun", ["run", "../../apps/execution/src/index.ts"]);

// Initialize Core Logic
// Mocking for now as they require their own initialization.
// Casting to unknown then expected type to satisfy Biome and TS.
const contextAssembler = new ContextAssembler(
  {} as unknown as import("@the-soul/search-core").SearchRetriever,
  {} as unknown as import("@the-soul/storage").FalkorClient,
);

const engine = new DecisionEngine(contextAssembler, mcpAdapter);

// Start Engine
engine.start();

// Kafka Consumer
const startConsumer = async () => {
  const consumer = await kafka.createConsumer("control-group");
  await consumer.subscribe({ topic: "parsed_events", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const value = message.value?.toString();
        if (!value) return;
        const event = JSON.parse(value);

        // Filter for user messages or system triggers
        if (event.type === "content" && event.role === "user") {
          console.log(`[Control] Received user input: ${event.content}`);
          // Trigger Decision Engine
          const sessionId = event.metadata?.session_id || event.original_event_id;
          await engine.handleInput(sessionId, event.content);
        }
      } catch (e) {
        console.error("Control processing error", e);
      }
    },
  });
};

// Start
console.log("Control Service starting...");
startConsumer().catch(console.error);
