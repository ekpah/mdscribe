import { call } from "@orpc/server";
import { tool } from "ai";
import { z } from "zod";

import { scribeAgentGenerateSectionHandler } from "@/orpc/scribe-agent/generate-section";
import { formatAudioTranscriptsForPrompt } from "@/orpc/scribe/handlers/audio-input";
import { getPromptHarnessTargetField } from "@/orpc/scribe/prompts";

import { findSection, runTracedTool } from "./shared";
import type { AgentToolDeps, SectionToolResult } from "./shared";

const buildSectionFormData = (deps: AgentToolDeps, sectionId: string, notes: string) => {
	const formData: Record<string, unknown> = { notes };
	for (const section of deps.sections) {
		if (section.id === sectionId || section.content.trim().length === 0) {
			continue;
		}
		formData[getPromptHarnessTargetField(section.harness)] = section.content;
	}
	return formData;
};

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
			"Erstellt einen kompletten Abschnitt des Arztbriefs neu mit der passenden AI Vorlage. Langsam und kostenintensiv: nur für ausdrücklich gewünschte vollständige Neugenerierungen oder umfangreiche, zusammenhängende neue Informationen nutzen. Für einzelne Angaben oder lokale Änderungen editSection verwenden.",
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
						section.formId
							? {
									audioFiles: deps.preparedMedia.usedTranscription ? [] : deps.audioFiles,
									contextFiles: deps.preparedMedia.usedFilePreprocessing ? [] : deps.contextFiles,
									formData: buildSectionFormData(deps, sectionId, notes),
									formId: section.formId,
									preparedAttachmentText: getPreparedAttachmentText(deps),
									source: "customForm" as const,
									traceContext: {
										agentRunId: deps.agentRunId,
										agentSectionId: sectionId,
										parentObservationId: toolObservationId,
										traceId: deps.traceId,
									},
								}
							: {
									audioFiles: deps.preparedMedia.usedTranscription ? [] : deps.audioFiles,
									contextFiles: deps.preparedMedia.usedFilePreprocessing ? [] : deps.contextFiles,
									documentType: section.harness,
									formData: buildSectionFormData(deps, sectionId, notes),
									preparedAttachmentText: getPreparedAttachmentText(deps),
									source: "documentType" as const,
									traceContext: {
										agentRunId: deps.agentRunId,
										agentSectionId: sectionId,
										parentObservationId: toolObservationId,
										traceId: deps.traceId,
									},
								},
						{ context: { db: deps.db, session: deps.session } },
					);
					return { content: result.text, ok: true, sectionId };
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
