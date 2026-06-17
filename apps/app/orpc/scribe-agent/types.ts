import type { UIMessage } from "ai";

import type { PromptHarnessId } from "@/orpc/scribe/prompts";
import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

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
	/**
	 * Audio recordings attached to the latest user turn. Attached natively when
	 * the standard model supports audio, otherwise transcribed via the
	 * speech-to-text slot. Not persisted between turns.
	 */
	audioFiles?: AudioFile[];
	/**
	 * Files attached to the latest user turn. Attached natively when the standard
	 * model supports documents, otherwise text is extracted via the file/image
	 * slot. Not persisted between turns.
	 */
	contextFiles?: FillInputsContextFile[];
}
