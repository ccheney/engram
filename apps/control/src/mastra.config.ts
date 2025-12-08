import { Mastra } from "@mastra/core";
import { mainLoop } from "./workflows/main_loop";

export const config = {
	name: "engram-control",
	workflows: {
		mainLoop,
	},
	agents: {},
};

export const mastra = new Mastra(config);
