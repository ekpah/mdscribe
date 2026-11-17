import type { TextInputId } from "@/orpc/scribe/prompts/template";

/** The text fields of a request by id; see `TEXT_INPUTS` in `prompts/template.ts`. */
export type PatientContextData = Record<TextInputId, string>;

export interface TemplateContextInput {
	content: string;
	examples: string[];
	information?: string;
	title: string;
}
