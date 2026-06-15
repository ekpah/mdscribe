import { createEditSectionTool } from "./edit-section";
import { createGenerateSectionTool } from "./generate-section";
import type { AgentToolDeps } from "./shared";

/**
 * Assemble the agent's tools. Add a new tool by dropping a file in this folder
 * and registering it here.
 */
export const createAgentTools = (deps: AgentToolDeps) => ({
	editSection: createEditSectionTool(deps),
	generateSection: createGenerateSectionTool(deps),
});
