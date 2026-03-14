import {
	composePatientContext,
	derivePatientContext,
} from "./patient";
import {
	buildSelectedTemplateReference,
	composeTemplateContext,
	composeTemplateContextFromSources,
} from "./template";
import { findRelevantTemplateForProcedure } from "./template/relevant-template";
import type {
	ComposedScribeContext,
	ComposeScribeContextInput,
	ContextBuildInput,
	ContextSource,
	TemplateContextInput,
} from "./types";
import { composeUserContext } from "./user";

export type {
	ComposedScribeContext,
	ComposeScribeContextInput,
	ContextBuildInput,
	ContextSource,
	PatientContextData,
	TemplateContextInput,
} from "./types";

export {
	buildSelectedTemplateReference,
	composePatientContext,
	composeTemplateContext,
	composeUserContext,
	derivePatientContext,
	findRelevantTemplateForProcedure,
};

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

const joinContextSections = (sections: string[]): string =>
	sections.filter((section) => section.trim().length > 0).join("\n\n");

export const buildScribeContext = async ({
	sessionUser,
	sources,
}: ContextBuildInput): Promise<Pick<ComposedScribeContext, "contextXml" | "patientContext">> => {
	const patientContext = derivePatientContext(sources);

	return {
		contextXml: joinContextSections([
			composePatientContext(sources),
			composeTemplateContextFromSources(sources),
			composeUserContext(sessionUser),
		]),
		patientContext,
	};
};

export const composeScribeContext = async (
	input: ComposeScribeContextInput,
): Promise<ComposedScribeContext> => {
	const sources = createContextSources(input);
	const { contextXml, patientContext } = await buildScribeContext({
		sessionUser: input.sessionUser,
		sources,
	});

	return {
		contextXml,
		patientContext,
		sources,
	};
};
