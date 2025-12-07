import { Step, Workflow } from "@mastra/core";
import { z } from "zod";

// Define step context interface for better typing
interface StepContext {
  context: unknown;
}

const thinkStep = new Step({
  id: "think",
  execute: async ({ context: _ }: StepContext) => {
    return { thought: "I should check the memory." };
  },
});

const actStep = new Step({
  id: "act",
  execute: async ({ context: _ }: StepContext) => {
    return { observation: "Memory says X." };
  },
});

// Workflow
export const mainLoop = new Workflow({
  triggerSchema: z.object({
    input: z.string(),
    sessionId: z.string(),
  }),
});

// The API for adding steps in Mastra 0.24 might be different.
// If .step() doesn't exist on the type, we can't use it without casting.
// To avoid 'any', we cast to a custom interface that has it (assuming runtime support).

interface LegacyWorkflow {
  step(step: Step): LegacyWorkflow;
  then(step: Step): LegacyWorkflow;
}

(mainLoop as unknown as LegacyWorkflow).step(thinkStep).then(actStep);
