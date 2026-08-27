import { tool } from "ai";
import { z } from "zod";

import { findSection, runTracedTool } from "./shared";
import type { AgentToolDeps, SectionToolResult } from "./shared";

/**
 * Apply a targeted diff to a section: replace the first occurrence of an exact
 * existing snippet with new text. For small, local corrections — use
 * `generateSection` for full (re)generation.
 */
export const createEditSectionTool = (deps: AgentToolDeps) =>
	tool({
		description:
			"Standardwerkzeug für Änderungen: aktualisiert einen Abschnitt gezielt, indem ein vorhandener Textausschnitt durch neuen Text ersetzt wird. Nutze es für einzelne neue Angaben, Ergänzungen, Streichungen und lokale Korrekturen statt generateSection.",
		execute: ({
			find,
			replace,
			sectionId,
		}: {
			find: string;
			replace: string;
			sectionId: string;
		}): Promise<SectionToolResult> =>
			runTracedTool({
				deps,
				execute: () => {
					const section = findSection(deps, sectionId);
					if (!section) {
						return { error: `Unbekannter Abschnitt: ${sectionId}`, ok: false };
					}
					if (!find) {
						return { error: "Kein Suchtext angegeben.", ok: false };
					}
					if (!section.content.includes(find)) {
						return {
							error: `Textausschnitt nicht in Abschnitt "${sectionId}" gefunden.`,
							ok: false,
						};
					}
					return { content: section.content.replace(find, replace), ok: true, sectionId };
				},
				inputData: { find, replace, sectionId },
				metadata: { findCharacters: find.length, replaceCharacters: replace.length },
				name: "editSection",
				sectionId,
			}),
		inputSchema: z.object({
			find: z.string().describe("Der exakte vorhandene Textausschnitt, der ersetzt werden soll."),
			replace: z.string().describe("Der neue Text, der den gefundenen Ausschnitt ersetzt."),
			sectionId: z.string().describe("Die ID des zu ändernden Abschnitts."),
		}),
	});
