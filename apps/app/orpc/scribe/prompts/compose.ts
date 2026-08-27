import type { DocumentType, PromptMessage, PromptVariables } from "@/orpc/scribe/types";

import { documentTypeConfigs, getDocumentTypeByPromptName } from "./registry";

interface PromptCompositionInput {
	contextPrompt?: string;
	contextXml: string;
	relevantTemplate?: string;
	todaysDate?: string;
}

const todaysDateDE = (): string =>
	new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});

const hasContent = (value: string | undefined): value is string =>
	typeof value === "string" && value.trim().length > 0;

const buildPromptMessages = (input: {
	systemPrompt: string;
	userPrompt: string;
}): PromptMessage[] => {
	const messages: PromptMessage[] = [];

	if (hasContent(input.systemPrompt)) {
		messages.push({
			content: input.systemPrompt.trim(),
			role: "system",
		});
	}

	if (hasContent(input.userPrompt)) {
		messages.push({
			content: input.userPrompt.trim(),
			role: "user",
		});
	}

	return messages;
};

export const createPromptVariables = (input: PromptCompositionInput): PromptVariables =>
	({
		contextXml: input.contextXml,
		relevantTemplate: input.relevantTemplate ?? "",
		todaysDate: input.todaysDate ?? todaysDateDE(),
	}) as PromptVariables;

export const composeDocumentTypePrompt = (
	documentType: DocumentType,
	input: PromptCompositionInput,
): PromptMessage[] =>
	buildPromptMessages({
		systemPrompt: documentTypeConfigs[documentType].systemPrompt,
		userPrompt: input.contextPrompt ?? input.contextXml,
	});

export const composePromptHarnessPrompt = (
	promptHarnessId: string,
	input: PromptCompositionInput,
): PromptMessage[] | undefined => {
	const documentType = getDocumentTypeByPromptName(promptHarnessId);
	if (!documentType) {
		return undefined;
	}

	return composeDocumentTypePrompt(documentType, input);
};
