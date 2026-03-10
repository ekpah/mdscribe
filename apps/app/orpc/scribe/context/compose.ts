import { buildScribeContext } from "./build";
import { derivePatientContext } from "./normalize";
import type { ContextBuildInput, ContextSource, PatientContextData } from "./types";

export interface TemplateContextInput extends Record<string, unknown> {
	content: string;
	examples: string[];
	title: string;
}

export interface ComposeScribeContextInput {
	formData: Record<string, unknown>;
	sessionUser?: ContextBuildInput["sessionUser"];
	template?: TemplateContextInput | null;
}

export interface ComposedScribeContext {
	contextXml: string;
	patientContext: PatientContextData;
	sources: ContextSource[];
}

export const createContextSources = ({
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

export async function composeScribeContext(
	input: ComposeScribeContextInput,
): Promise<ComposedScribeContext> {
	const sources = createContextSources(input);
	const { contextXml } = await buildScribeContext({
		sessionUser: input.sessionUser,
		sources,
	});

	return {
		contextXml,
		patientContext: derivePatientContext(sources),
		sources,
	};
}
