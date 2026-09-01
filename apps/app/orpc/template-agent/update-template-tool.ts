import { tool } from "ai";
import { validateMarkdocTemplate } from "markdoc-md";
import { z } from "zod";

const MAX_TEMPLATE_LENGTH = 100_000;

const formatDiagnostic = (
	diagnostic: ReturnType<typeof validateMarkdocTemplate>[number],
): string => ("message" in diagnostic ? diagnostic.message : diagnostic.code);

/**
 * The agent can converse freely; this is the only path that mutates the live
 * editor. The client applies successful output exactly once per tool call.
 */
export const createUpdateTemplateTool = () =>
	tool({
		description:
			"Ersetzt den Inhalt der aktuellen MDScribe-Vorlage. Nur aufrufen, wenn der Nutzer ausdrücklich eine Vorlage erstellen oder inhaltlich ändern möchte. Für Fragen, Erklärungen und Beratung normal antworten, ohne dieses Werkzeug aufzurufen.",
		execute: ({ content }: { content: string }) => {
			if (content.length > MAX_TEMPLATE_LENGTH) {
				return { error: "Die Vorlage ist zu lang.", ok: false as const };
			}

			const errors = validateMarkdocTemplate(content).filter(
				(diagnostic) => diagnostic.severity === "error",
			);
			if (errors.length > 0) {
				const [firstError] = errors;
				return {
					error: firstError ? formatDiagnostic(firstError) : "Ungültige Markdoc-Vorlage.",
					ok: false as const,
				};
			}

			return { content, ok: true as const };
		},
		inputSchema: z.object({
			content: z
				.string()
				.max(MAX_TEMPLATE_LENGTH)
				.describe("Der vollständige neue Markdoc-Inhalt der Vorlage, ohne Markdown-Codeblock."),
		}),
	});
