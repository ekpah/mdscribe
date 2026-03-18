import { composePatientContext, derivePatientContext } from "./patient";
import { buildSelectedTemplateReference, composeTemplateContext } from "./template";
import { findRelevantTemplateForProcedure } from "./template/relevant-template";
import type {
	ComposedScribeContext,
	ComposeScribeContextInput,
	ContextSource,
} from "./types";
import { composeUserContext } from "./user";

export type { ContextBuildInput, TemplateContextInput } from "./types";

export {
	
	findRelevantTemplateForProcedure,
};

const hasContent = (value: string | undefined): value is string =>
	typeof value === "string" && value.trim().length > 0;

const todaysDateDE = (): string =>
	new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});

const createContextSources = ({
	formData,
	template,
}: Pick<ComposeScribeContextInput, "formData" | "template">): ContextSource[] => {
	const sources: ContextSource[] = [{ data: formData, kind: "form" }];

	if (template) {
		sources.push({
			data: template,
			kind: "template",
		});
	}

	return sources;
};

const composeUnifiedContext = (sections: Array<string | undefined>): string => {
	const contextSections = sections.filter(hasContent);
	if (contextSections.length === 0) {
		return "";
	}

	return `<context>\n${contextSections.join("\n\n")}\n</context>`;
};

export const composeScribeContextPrompt = (input: {
	contextXml: string;
	todaysDate?: string;
}): string => {
	const date = input.todaysDate ?? todaysDateDE();
	return [`Das heutige Datum ist der ${date}.`, input.contextXml]
		.filter(hasContent)
		.join("\n\n");
};

export const composeScribeContext = (
	input: ComposeScribeContextInput,
): ComposedScribeContext => {
	const sources = createContextSources(input);

	const patientContext = derivePatientContext(sources);
	const templateContext = composeTemplateContext({
		promptContextKey: input.promptContextKey,
		selectedTemplateReference: input.selectedTemplateReference,
		sources,
	});
	const userContext = composeUserContext(input.sessionUser);
	// Context composition order is intentional:
	// 1) template guidance (target structure/style),
	// 2) user/doctor context,
	// 3) patient context (diagnoseblock, anamnese, befunde, notizen).
	const contextXml = composeUnifiedContext([
		templateContext,
		userContext,
		composePatientContext(sources),
	]);
	const contextPrompt = composeScribeContextPrompt({
		contextXml,
		todaysDate: input.todaysDate,
	});

	return {
		contextPrompt,
		contextXml,
		patientContext,
		sources,
	};
};
