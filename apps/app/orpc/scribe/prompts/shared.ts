import type { PromptMessage } from "../types";

export const CONTEXT_GUIDANCE_TOKEN = "__CONTEXT_GUIDANCE__";

export interface PromptHarness<T> {
	system: string;
	userMessages: (vars: T) => PromptMessage[];
}

const hasContent = (value?: string): value is string =>
	typeof value === "string" && value.trim().length > 0;

export const renderSystemPrompt = (
	system: string,
	contextGuidance?: string,
): string => {
	if (system.includes(CONTEXT_GUIDANCE_TOKEN)) {
		return system.replace(CONTEXT_GUIDANCE_TOKEN, contextGuidance ?? "");
	}

	if (hasContent(contextGuidance)) {
		return `${system}\n\n${contextGuidance}`;
	}

	return system;
};

export const createPromptMessages = <T>(
	harness: PromptHarness<T>,
	vars: T,
	contextGuidance?: string,
): PromptMessage[] => [
	{
		role: "system",
		content: renderSystemPrompt(harness.system, contextGuidance),
	},
	...harness.userMessages(vars),
];
