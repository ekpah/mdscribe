import type { UIMessage } from "ai";

import type { PromptHarnessId } from "@/orpc/scribe/prompts";

/**
 * A section of the doctor's note the agent can read and edit. The editor sends
 * the current state with every turn so the agent always reasons over the
 * up-to-date letter. `harness`/`templateId` mirror the section's AI Vorlage so
 * the agent generates with the same prompt + template as the editor.
 */
export interface ScribeAgentSection {
	id: string;
	label: string;
	content: string;
	harness: PromptHarnessId;
	templateId?: string | null;
}

export interface ScribeAgentChatInput {
	messages: UIMessage[];
	sections: ScribeAgentSection[];
}
