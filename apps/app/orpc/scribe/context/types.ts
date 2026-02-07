import type { DocumentType } from "../types";

export interface ContextBuildInput {
	documentType: DocumentType;
	processedInput: Record<string, unknown>;
	rawPrompt: Record<string, unknown>;
	sessionUser?: { name?: string | null } | null;
}

export interface ContextBlock {
	tag: string;
	content: string;
}

export interface ContextProvider {
	id: string;
	build: (
		input: ContextBuildInput,
	) => ContextBlock | null | Promise<ContextBlock | null>;
}

export interface ContextSectionSpec {
	tag: string;
	purpose: string;
	usage: string;
	getContent: (input: Record<string, unknown>) => string;
}
