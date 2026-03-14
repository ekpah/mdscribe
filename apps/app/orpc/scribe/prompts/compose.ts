import type { DocumentType, ModelConfig, PromptMessage, PromptVariables } from "@/orpc/scribe/types";
import { TEMPLATE_USAGE_INSTRUCTION } from "./families/narrative/shared/template-usage";
import {
	documentTypeConfigs,
	getDocumentTypeConfigByPromptName,
	getPromptHarnessById,
} from "./registry";

interface PromptCompositionInput {
	contextXml: string;
	relevantTemplate?: string;
	todaysDate?: string;
}

const toNumberOrUndefined = (value: number | string | null | undefined): number | undefined => {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
};

const todaysDateDE = (): string =>
	new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});

export const createPromptVariables = (input: PromptCompositionInput): PromptVariables =>
	({
		contextXml: input.contextXml,
		relevantTemplate: input.relevantTemplate ?? "",
		todaysDate: input.todaysDate ?? todaysDateDE(),
	}) as PromptVariables;

export const injectCustomTemplateInstruction = (
	messages: PromptMessage[],
	hasTemplateContext: boolean,
): PromptMessage[] => {
	if (!hasTemplateContext) {
		return messages;
	}

	const [firstMessage, ...rest] = messages;
	if (firstMessage?.role === "system") {
		return [firstMessage, { content: TEMPLATE_USAGE_INSTRUCTION, role: "system" }, ...rest];
	}

	return [{ content: TEMPLATE_USAGE_INSTRUCTION, role: "system" }, ...messages];
};

export const composeDocumentTypePrompt = (
	documentType: DocumentType,
	input: PromptCompositionInput,
): PromptMessage[] => documentTypeConfigs[documentType].prompt(createPromptVariables(input));

export const composePromptHarnessPrompt = (
	promptHarnessId: string,
	input: PromptCompositionInput,
): PromptMessage[] | undefined => {
	const promptHarness = getPromptHarnessById(promptHarnessId);
	if (!promptHarness) {
		return undefined;
	}

	return promptHarness.buildPrompt(createPromptVariables(input));
};

export const resolveCustomModelConfig = (form: {
	maxTokens: number | null;
	promptHarness: string;
	temperature: number | string | null;
	thinkingBudget: number | null;
}): ModelConfig => {
	const fallbackConfig = getDocumentTypeConfigByPromptName(form.promptHarness)?.modelConfig;
	const explicitThinkingBudget = form.thinkingBudget ?? undefined;
	const fallbackThinkingBudget = fallbackConfig?.thinkingBudget;
	const thinkingBudget = explicitThinkingBudget ?? fallbackThinkingBudget;

	return {
		maxTokens: form.maxTokens ?? fallbackConfig?.maxTokens ?? 20_000,
		temperature: toNumberOrUndefined(form.temperature) ?? fallbackConfig?.temperature ?? 1,
		thinking:
			explicitThinkingBudget === undefined
				? (fallbackConfig?.thinking ?? false)
				: true,
		thinkingBudget,
	};
};
