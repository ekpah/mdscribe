import {
	composePatientContext,
	derivePatientContext,
} from "./patient";
import {
	buildSelectedTemplateReference,
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
	ContextBuildInput,
	TemplateContextInput,
} from "./types";

export {
	buildSelectedTemplateReference,
	findRelevantTemplateForProcedure,
};

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

const joinContextSections = (sections: string[]): string =>
	sections.filter((section) => section.trim().length > 0).join("\n\n");

export const buildScribeContext = ({
	sessionUser,
	sources,
}: ContextBuildInput): Pick<ComposedScribeContext, "contextXml" | "patientContext"> => {
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

export const composeScribeContext = (
	input: ComposeScribeContextInput,
): ComposedScribeContext => {
	const sources = createContextSources(input);
	const { contextXml, patientContext } = buildScribeContext({
		sessionUser: input.sessionUser,
		sources,
	});

	return {
		contextXml,
		patientContext,
		sources,
	};
};
