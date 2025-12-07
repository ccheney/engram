import { assign, createMachine } from "xstate";

export interface AgentContext {
  sessionId: string;
  input: string;
  contextString?: string;
  thoughts: string[];
  // Using unknown instead of any where possible, but keeping arrays flexible
  // biome-ignore lint/suspicious/noExplicitAny: Tool calls structure varies
  currentToolCalls: any[];
  // biome-ignore lint/suspicious/noExplicitAny: Tool outputs vary
  toolOutputs: any[];
  finalResponse?: string;
  // biome-ignore lint/suspicious/noExplicitAny: History structure varies
  history: any[];
}

export const agentMachine = createMachine({
  id: "agent",
  initial: "idle",
  context: {
    sessionId: "",
    input: "",
    thoughts: [],
    currentToolCalls: [],
    toolOutputs: [],
    history: [],
  } as AgentContext,
  states: {
    idle: {
      on: {
        START: {
          target: "analyzing",
          actions: "assignInput",
        },
      },
    },
    analyzing: {
      invoke: {
        src: "fetchContext",
        input: ({ context }) => context, // Pass context as input to actor
        onDone: {
          target: "deliberating",
          actions: assign(({ event }) => ({
            contextString: event.output.contextString,
          })),
        },
        onError: { target: "idle" },
      },
    },
    deliberating: {
      invoke: {
        src: "generateThought",
        input: ({ context }) => context,
        onDone: [
          {
            target: "acting",
            guard: "requiresTool",
            actions: assign(({ event }) => ({
              thoughts: event.output.thought ? [event.output.thought] : [],
              currentToolCalls: event.output.toolCalls || [],
            })),
          },
          {
            target: "responding",
            actions: assign(({ event }) => ({
              finalResponse: event.output.thought,
            })),
          },
        ],
      },
    },
    acting: {
      invoke: {
        src: "executeTool",
        input: ({ context }) => context,
        onDone: {
          target: "reviewing",
          actions: assign(({ event }) => ({
            toolOutputs: event.output.toolOutputs,
          })),
        },
        onError: { target: "reviewing" },
      },
    },
    reviewing: {
      always: { target: "deliberating" },
    },
    responding: {
      invoke: {
        src: "streamResponse",
        input: ({ context }) => context,
        onDone: { target: "idle" },
      },
    },
  },
});
