import { call } from "@orpc/server";
import { tool } from "ai";
import { z } from "zod";

import { splitSectionOutput } from "@/features/template-tags/sections";
import { scribeAgentGenerateSectionHandler } from "@/orpc/scribe-agent/generate-section";
import { formatAudioTranscriptsForPrompt } from "@/orpc/scribe/handlers/audio-input";

import { findSection, runTracedTool } from "./shared";
import type { AgentToolDeps, SectionToolResult } from "./shared";

// The agent's notes are the target's input; every written section, including the target's draft, is context.
const buildSectionFormData = (deps: AgentToolDeps, sectionId: string, notes: string) => ({
	background: deps.background,
	notes,
	sections: Object.fromEntries(
		deps.sections
			.filter((section) => section.content.trim().length > 0)
			.map((section) => [section.id, section.content]),
	),
	targetSectionId: sectionId,
});

const getPreparedAttachmentText = (deps: AgentToolDeps): string | undefined => {
	const sections = [
		deps.preparedMedia.usedTranscription
			? formatAudioTranscriptsForPrompt(deps.preparedMedia.audioTranscripts)
			: "",
		deps.preparedMedia.usedFilePreprocessing ? deps.preparedMedia.fileTextContext : "",
	].filter(Boolean);
	return sections.length > 0 ? sections.join("\n\n") : undefined;
};

/**
 * Generates a full letter section through the normal non-streaming scribe
 * procedure. The agent's own model always receives media first; this call
 * reuses already extracted text and otherwise forwards native media for the
 * generation model to handle through the canonical scribe pipeline.
 */
export const createGenerateSectionTool = (deps: AgentToolDeps) =>
	tool({
		description:
			"Erstellt einen kompletten Abschnitt des Arztbriefs neu mit der Vorlage des Briefs. Langsam und kostenintensiv: nur für ausdrücklich gewünschte vollständige Neugenerierungen oder umfangreiche, zusammenhängende neue Informationen nutzen. Für einzelne Angaben oder lokale Änderungen editSection verwenden.",
		execute: ({ notes, sectionId }): Promise<SectionToolResult> =>
			runTracedTool({
				deps,
				execute: async (toolObservationId) => {
					const section = findSection(deps, sectionId);
					if (!section) {
						return { error: `Unbekannter Abschnitt: ${sectionId}`, ok: false };
					}
					const result = await call(
						scribeAgentGenerateSectionHandler,
						{
							audioFiles: deps.preparedMedia.usedTranscription ? [] : deps.audioFiles,
							contextFiles: deps.preparedMedia.usedFilePreprocessing ? [] : deps.contextFiles,
							formData: buildSectionFormData(deps, sectionId, notes),
							preparedAttachmentText: getPreparedAttachmentText(deps),
							templateId: deps.templateId,
							traceContext: {
								agentRunId: deps.agentRunId,
								agentSectionId: sectionId,
								parentObservationId: toolObservationId,
								traceId: deps.traceId,
							},
						},
						{ context: { db: deps.db, session: deps.session } },
					);
					// The model answers in the section frame; fall back to the bare text.
					const content = splitSectionOutput(result.text)[sectionId] ?? result.text.trim();
					return { content, ok: true, sectionId };
				},
				inputData: { notes, sectionId },
				name: "generateSection",
				sectionId,
			}),
		inputSchema: z.object({
			notes: z.string().describe("Die rohen Notizen / klinischen Informationen für den Abschnitt."),
			sectionId: z.string().describe("Die ID des zu generierenden Abschnitts."),
		}),
	});
