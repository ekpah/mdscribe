import { eq, template } from "@repo/database";
import type { Database } from "@repo/database";
import { tool } from "ai";
import { z } from "zod";

import type { TemplateContextInput } from "@/orpc/scribe/context";

import { generateSectionContent } from "../lib/generate-section-content";
import { findSection } from "./shared";
import type { AgentToolDeps, SectionToolResult } from "./shared";

const loadTemplate = async (
	db: Database,
	templateId: string | null | undefined,
): Promise<TemplateContextInput | null> => {
	if (!templateId) {
		return null;
	}
	const row = await db.query.template.findFirst({
		columns: { content: true, examples: true, title: true },
		where: eq(template.id, templateId),
	});
	return row
		? { content: row.content, examples: row.examples, title: row.title }
		: null;
};

/**
 * Generate a whole section from scratch using the section's AI Vorlage (the
 * same harness + template as the editor's per-field generation). The other
 * sections of the current letter are passed explicitly as clinical context.
 */
export const createGenerateSectionTool = (deps: AgentToolDeps) =>
	tool({
		description:
			"Erstellt einen kompletten Abschnitt des Arztbriefs neu mit dem passenden klinischen Prompt (wie die KI-Generierung im Editor). Die übrigen Abschnitte des aktuellen Briefs werden automatisch als klinischer Kontext einbezogen. Nutze dies, wenn ein Abschnitt aus Notizen oder neuen Informationen vollständig erzeugt bzw. neu generiert werden soll.",
		execute: async ({
			notes,
			sectionId,
		}: {
			notes: string;
			sectionId: string;
		}): Promise<SectionToolResult> => {
			const section = findSection(deps, sectionId);
			if (!section) {
				return { error: `Unbekannter Abschnitt: ${sectionId}`, ok: false };
			}

			const content = await generateSectionContent({
				activeSubscription: deps.activeSubscription,
				audioTranscripts: deps.preparedMedia.audioTranscripts,
				contextFileSummaries: deps.preparedMedia.fileSummaries.map((summary) => ({ ...summary })),
				contextSections: deps.sections.filter(
					(candidate) => candidate.id !== sectionId,
				),
				db: deps.db,
				fileTextContext: deps.preparedMedia.fileTextContext,
				generation: deps.generation,
				harness: section.harness,
				notes,
				providerOptions: deps.providerOptions,
				sessionUser: deps.sessionUser,
				temperature: deps.temperature,
				template: await loadTemplate(deps.db, section.templateId),
				userId: deps.userId,
			});

			return { content, ok: true, sectionId };
		},
		inputSchema: z.object({
			notes: z
				.string()
				.describe(
					"Die rohen Notizen / klinischen Informationen, aus denen der Abschnitt erzeugt werden soll.",
				),
			sectionId: z.string().describe("Die ID des zu generierenden Abschnitts."),
		}),
	});
