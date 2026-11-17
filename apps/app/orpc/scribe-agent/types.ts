import type { UIMessage } from "ai";

import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

/**
 * A section of the doctor's note the agent can read and edit. The editor sends
 * the current state with every turn so the agent always reasons over the
 * up-to-date letter. Sections are the `{% section %}` blocks of `templateId`.
 */
export interface ScribeAgentSection {
	id: string;
	label: string;
	content: string;
}

export interface ScribeAgentChatInput {
	messages: UIMessage[];
	/** Hintergrundinformationen of the letter: a fact source that is not copied. */
	background?: string;
	sections: ScribeAgentSection[];
	/** The template whose sections the letter consists of; generateSection uses it. */
	templateId: string;
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
