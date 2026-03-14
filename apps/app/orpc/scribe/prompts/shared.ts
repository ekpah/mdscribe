import type { PromptMessage } from "@/orpc/scribe/types";

export type PromptPart<T> = string | ((vars: T) => string | undefined);

const hasContent = (value?: string): value is string =>
	typeof value === "string" && value.trim().length > 0;

const renderPromptPart = <T>(part: PromptPart<T>, vars: T): string | undefined =>
	typeof part === "function" ? part(vars) : part;

const joinPromptParts = <T>(parts: PromptPart<T>[], vars: T): string =>
	parts
		.map((part) => renderPromptPart(part, vars))
		.filter(hasContent)
		.join("\n\n");

export const createPromptMessages = <T>(
	parts: {
		systemParts: PromptPart<T>[];
		userParts: PromptPart<T>[];
	},
	vars: T,
): PromptMessage[] => {
	const messages: PromptMessage[] = [];
	const systemContent = joinPromptParts(parts.systemParts, vars);
	const userContent = joinPromptParts(parts.userParts, vars);

	if (systemContent) {
		messages.push({
			content: systemContent,
			role: "system",
		});
	}

	if (userContent) {
		messages.push({
			content: userContent,
			role: "user",
		});
	}

	return messages;
};
