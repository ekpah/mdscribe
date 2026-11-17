import { hasContent, toTrimmedString } from "@/orpc/scribe/_lib/text";
import { TEXT_INPUT_IDS } from "@/orpc/scribe/prompts/template";

import { renderPatientContextSections } from "./patient/guidance";
import { renderTemplateContext } from "./template/guidance";
import type { PatientContextData, TemplateContextInput } from "./types";

/** Autofill's `<context>` block: the fill hints first, then the case's text fields. */
export const composeFillInputsContext = ({
	template,
	textContext,
}: {
	template: TemplateContextInput | null;
	textContext: Record<string, unknown>;
}): string => {
	const sections = [
		renderTemplateContext(template),
		renderPatientContextSections(
			Object.fromEntries(
				TEXT_INPUT_IDS.map((id) => [id, toTrimmedString(textContext[id])]),
			) as PatientContextData,
		),
	].filter(hasContent);
	return sections.length ? `<context>\n${sections.join("\n\n")}\n</context>` : "";
};
