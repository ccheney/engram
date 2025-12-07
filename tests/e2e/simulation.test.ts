import { describe, it, expect, mock, beforeEach } from "bun:test";
// Import directly from source to avoid resolution issues in test environment without build
import { ThinkingExtractor } from "../../packages/ingestion-core/src/index";
import { DecisionEngine } from "../../apps/control/src/engine/decision";
import { ContextAssembler } from "../../apps/control/src/context/assembler";
import { McpToolAdapter } from "../../apps/control/src/tools/mcp_client";

// Mocks
const mockMcp = new McpToolAdapter("echo", []);
mockMcp.connect = mock(async () => {});
mockMcp.listTools = mock(async () => [
  { name: "read_file", description: "read", parameters: {} },
]);
mockMcp.createMastraStep = mock((name) => ({
  id: name,
  execute: async ({ inputData }: any) => {
    console.log(`[MockExecution] Tool ${name} called with`, inputData);
    return { result: "success" };
  },
} as any));

const mockFalkor = {
  connect: mock(async () => {}),
  query: mock(async () => []),
};

const mockSearch = {
  search: mock(async () => []),
};

describe("System E2E Simulation", () => {
  it("should extract thinking tags correctly", () => {
    const extractor = new ThinkingExtractor();
    const input = "Hello <thinking>I need to process this</thinking> world";
    const delta = extractor.process(input);
    
    expect(delta.content).toBe("Hello  world");
    expect(delta.thought).toBe("I need to process this");
  });

  it("should initialize decision engine", async () => {
    const assembler = new ContextAssembler(
      mockSearch as any, 
      mockFalkor as any
    );
    
    const engine = new DecisionEngine(assembler, mockMcp);
    engine.start();
    
    // Just verify it starts without crashing
    expect(engine).toBeDefined();
  });
});