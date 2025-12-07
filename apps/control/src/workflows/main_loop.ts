import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

// Define Schemas
const SessionInputSchema = z.object({
  input: z.string(),
  sessionId: z.string(),
});

const ThoughtSchema = z.object({
  thought: z.string(),
});

const ObservationSchema = z.object({
  observation: z.string(),
});

// Using unknown instead of any for args to appease Biome while bypassing strict shape check
const thinkStep = createStep({
  id: "think",
  inputSchema: SessionInputSchema,
  outputSchema: ThoughtSchema,
  execute: async (_args: unknown) => {
    return { thought: "I should check the memory." };
  },
});

const actStep = createStep({
  id: "act",
  inputSchema: ThoughtSchema,
  outputSchema: ObservationSchema,
  execute: async (_args: unknown) => {
    return { observation: "Memory says X." };
  },
});

export const mainLoop = createWorkflow({
  id: "main-loop",
  inputSchema: SessionInputSchema,
  outputSchema: ObservationSchema,
})
  .then(thinkStep)
  .then(actStep)
  .commit();
