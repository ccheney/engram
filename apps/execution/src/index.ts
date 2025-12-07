import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Rehydrator, TimeTravelService } from "@the-soul/execution-core";
import { createFalkorClient } from "@the-soul/storage";
import { PatchManager, VirtualFileSystem } from "@the-soul/vfs";
import { DEFAULT_CONFIG, Executor, SECURE_POLICY, WasmLoader } from "@the-soul/wassette";
import { z } from "zod";

// Initialize Core Services
const vfs = new VirtualFileSystem();
const patchManager = new PatchManager(vfs);
const loader = new WasmLoader();
const executor = new Executor(DEFAULT_CONFIG, SECURE_POLICY);
const falkor = createFalkorClient();
const rehydrator = new Rehydrator(falkor);
const timeTravel = new TimeTravelService(rehydrator);

const server = new McpServer({
  name: "soul-execution",
  version: "1.0.0",
});

server.tool(
  "read_file",
  "Read a file from the Virtual File System",
  {
    path: z.string(),
  },
  async ({ path }) => {
    try {
      const content = vfs.readFile(path);
      return {
        content: [{ type: "text", text: content }],
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "apply_patch",
  "Apply a unified diff or search/replace block to the VFS",
  {
    path: z.string(),
    diff: z.string(),
  },
  async ({ path, diff }) => {
    try {
      patchManager.applyUnifiedDiff(path, diff);
      return {
        content: [{ type: "text", text: `Successfully patched ${path}` }],
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "execute_tool",
  "Execute a tool (function) inside the Wasm sandbox",
  {
    tool_name: z.string(),
    args_json: z.string(),
  },
  async ({ tool_name, args_json: _args_json }) => {
    try {
      const module = await loader.load("python");
      const result = await executor.execute(module, [tool_name]);

      return {
        content: [{ type: "text", text: result.stdout }],
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// New Tool: Time Travel
server.tool(
  "list_files_at_time",
  "List files in the VFS at a specific point in time",
  {
    session_id: z.string(),
    timestamp: z.number().describe("Epoch timestamp"),
    path: z.string().optional().default("/"),
  },
  async ({ session_id, timestamp, path }) => {
    try {
      await falkor.connect();
      const files = await timeTravel.listFiles(session_id, timestamp, path);
      return {
        content: [{ type: "text", text: JSON.stringify(files) }],
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Soul Execution MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
