import { type } from "@orpc/server";
import type { UIMessage } from "ai";

import { startUsageObservation } from "@/lib/usage-tracing";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { runScribeGeneration } from "@/orpc/scribe/handlers/scribe-stream";
import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

export interface AgentSectionGenerationInput {
	/** Template payload: `{ notes, background, sections, targetSectionId }`. */
	formData: Record<string, unknown>;
	templateId: string;
	/** Only present for media that the agent already had to preprocess. */
	preparedAttachmentText?: string;
	audioFiles?: AudioFile[];
	contextFiles?: FillInputsContextFile[];
	traceContext?: {
		agentRunId: string;
		agentSectionId: string;
		parentObservationId?: string;
		traceId?: string;
	};
}

const toScribeMessages = (formData: Record<string, unknown>): UIMessage[] => [
	{
		id: crypto.randomUUID(),
		parts: [{ text: JSON.stringify(formData), type: "text" }],
		role: "user",
	},
];

/**
 * Internal non-streaming oRPC entrypoint for agent tools. It deliberately uses
 * the canonical scribe executor, so template access, limits, and
 * UsageEvents cannot drift from the editor's generation path.
 */
export const scribeAgentGenerateSectionHandler = authed
	.use(scribeEntitlementsMiddleware)
	.input(type<AgentSectionGenerationInput>())
	.handler(async ({ context, input }) => {
		const observationId = input.traceContext?.traceId
			? await startUsageObservation({
					db: context.db,
					metadata: { sectionId: input.traceContext.agentSectionId },
					name: "generateSection",
					parentObservationId: input.traceContext.parentObservationId,
					traceId: input.traceContext.traceId,
					type: "generation",
				})
			: undefined;

		const { generation } = await runScribeGeneration({
			context,
			input: {
				audioFiles: input.audioFiles,
				contextFiles: input.contextFiles,
				messages: toScribeMessages(input.formData),
				templateId: input.templateId,
			},
			preparedAttachmentText: input.preparedAttachmentText,
			traceContext: input.traceContext ? { ...input.traceContext, observationId } : undefined,
		});

		return { text: await generation.text };
	});
