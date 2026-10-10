import { tool } from "ai";
import { validateMarkdocTemplate } from "markdoc-md";

import { templateSectionUpdateSchema } from "@/lib/template-section-update";
import { formatMarkdocTagDiagnostic } from "@/lib/user-messages";

import type { TemplateSections } from "./types";

/**
 * The agent can converse freely; this is the only path that mutates the live
 * editor. The client applies successful output exactly once per tool call.
 */
export const createUpdateTemplateTool = () =>
	tool({
		description:
			"Ersetzt nur die angegebenen Abschnitte der aktuellen Vorlage: content, examples, information. Unveränderte Abschnitte weglassen. Nur bei ausdrücklichem Änderungswunsch aufrufen, nicht für Fragen oder Beratung.",
		execute: (input: Partial<TemplateSections>) => {
			const parsed = templateSectionUpdateSchema.safeParse(input);
			if (!parsed.success) {
				return {
					error: parsed.error.issues[0]?.message ?? "Ungültige Abschnitte.",
					ok: false as const,
				};
			}

			const errors = (
				parsed.data.content === undefined ? [] : validateMarkdocTemplate(parsed.data.content)
			).filter((diagnostic) => diagnostic.severity === "error");
			if (errors.length > 0) {
				// Every problem with its tag name, so the agent can fix all of them at once.
				return { error: errors.map(formatMarkdocTagDiagnostic).join("\n"), ok: false as const };
			}

			return { ...parsed.data, ok: true as const };
		},
		inputSchema: templateSectionUpdateSchema,
	});
