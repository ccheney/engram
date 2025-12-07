import { createKafkaClient, createFalkorClient } from "@the-soul/storage";
import { ContextAssembler } from "./context/assembler";
import { SessionManager } from "./session/manager";
import { McpToolAdapter } from "./tools/mcp_client";

// Initialize Services
const kafka = createKafkaClient("control-service");
const falkor = createFalkorClient();

// Initialize MCP Adapter
// For V1 scaffold: We'll spawn 'bun run apps/execution/src/index.ts' if local.
const mcpAdapter = new McpToolAdapter("bun", ["run", "../../apps/execution/src/index.ts"]);

// Initialize Core Logic
// TODO: Replace with real SearchRetriever when available or mocked properly
const contextAssembler = new ContextAssembler(
  {} as unknown as import("@the-soul/search-core").SearchRetriever,
  falkor,
);

const sessionManager = new SessionManager(contextAssembler, mcpAdapter, falkor);

// Connect to DB
async function init() {
  await falkor.connect();
  console.log("FalkorDB connected");
}

// Kafka Consumer
const startConsumer = async () => {
  await init();

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
          // Trigger Session Manager
          const sessionId = event.metadata?.session_id || event.original_event_id;
          if (!sessionId) {
             console.warn("No session_id in event metadata");
             return;
          }
          await sessionManager.handleInput(sessionId, event.content);
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
