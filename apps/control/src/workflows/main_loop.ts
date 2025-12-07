import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

interface StepContext {
  context: unknown;
}

const thinkStep = {
  id: "think",
  execute: async ({ context: _ }: StepContext) => {
    return { thought: "I should check the memory." };
  },
};

const actStep = {
  id: "act",
  execute: async ({ context: _ }: StepContext) => {
    return { observation: "Memory says X." };
  },
};

// Workflow
export const mainLoop = createWorkflow({
  id: "main-loop",
  inputSchema: z.object({}),
  outputSchema: z.object({}),
})
  // Using unknown cast to satisfy TS 'Step' type requirements from V1 mock objects,
  // and satisfy Biome by avoiding direct 'as any' if possible, but since 'unknown' isn't callable/chainable
  // in the framework sense, we might need suppression if we can't use a better type.
  // However, Biome 'noExplicitAny' is triggered by 'as any'.
  // 'as unknown' is safe.
  // But 'as unknown' passed to .then() might fail TS if .then() expects a Step.
  // TS is happy with 'as any'. Biome is not.
  // To fix Biome, we can use a suppression comment properly.
  // biome-ignore lint/suspicious/noExplicitAny: Mock steps need any cast for now
  .then(thinkStep as any)
  // biome-ignore lint/suspicious/noExplicitAny: Mock steps need any cast for now
  .then(actStep as any)
  .commit();
