import { tool } from "ai";
import { z } from "zod";

import { findSection } from "./shared";
import type { AgentToolDeps, SectionToolResult } from "./shared";

/**
 * Apply a targeted diff to a section: replace the first occurrence of an exact
 * existing snippet with new text. For small, local corrections — use
 * `generateSection` for full (re)generation.
 */
export const createEditSectionTool = (deps: AgentToolDeps) =>
	tool({
		description:
			"Ändert einen Abschnitt gezielt, indem ein vorhandener Textausschnitt durch einen neuen ersetzt wird (Diff). Nutze dies für kleine, lokale Korrekturen statt einer Neugenerierung.",
		execute: ({
			find,
			replace,
			sectionId,
		}: {
			find: string;
			replace: string;
			sectionId: string;
		}): SectionToolResult => {
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

			return {
				content: section.content.replace(find, replace),
				ok: true,
				sectionId,
			};
		},
		inputSchema: z.object({
			find: z
				.string()
				.describe(
					"Der exakte vorhandene Textausschnitt, der ersetzt werden soll.",
				),
			replace: z
				.string()
				.describe("Der neue Text, der den gefundenen Ausschnitt ersetzt."),
			sectionId: z.string().describe("Die ID des zu ändernden Abschnitts."),
		}),
	});
