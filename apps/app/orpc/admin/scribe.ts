import { streamToEventIterator } from "@orpc/server";
import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { z } from "zod";

import { FILL_INPUT_PAYLOAD_LIMITS } from "@/lib/input-fill-limits";
import { ocrResultSchema } from "@/lib/ocr-types";
import { extractOpenRouterUsage } from "@/lib/usage-logging";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import {
	validateScribeAudioFiles,
	validateScribeContextFiles,
} from "@/orpc/scribe/handlers/media-limits";
import { appendScribeInputAttachmentsToMessages } from "@/orpc/scribe/handlers/scribe-stream";
import {
	buildProviderOptions,
	resolveModelByRecordId,
	resolveOcrSelection,
	resolveProviderModel,
} from "@/orpc/scribe/providers";
import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

interface AdminRunMetrics {
	cost?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	reasoningTokens?: number;
}

const reasoningEffortSchema = z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]);

const audioFileInputSchema = z.object({
	data: z.string().min(1),
	mimeType: z.string().min(1),
	wavFallback: z
		.object({
			data: z.string().min(1),
			mimeType: z.literal("audio/wav"),
		})
		.optional(),
});

const rawContextFileInputSchema = z.object({
	data: z.string().min(1),
	kind: z.literal("file").optional(),
	mimeType: z.string().min(1),
	name: z.string().min(1),
	size: z.number().nonnegative(),
});

const contextFileInputSchema = z.union([
	rawContextFileInputSchema,
	z
		.object({
			kind: z.literal("ocr"),
			name: z.string().min(1),
			ocrResult: ocrResultSchema,
		})
		.strict(),
]);

const asFiniteNumber = (value: unknown): number | undefined => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	return value;
};

// The Playground compiles the prompt in the browser with `composeTemplatePrompt`,
// so admins can edit it before a run; the server only attaches media and streams.
const runInput = z.object({
	audioFiles: z.array(audioFileInputSchema).max(FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles).optional(),
	contextFiles: z
		.array(contextFileInputSchema)
		.max(FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles)
		.optional(),
	messages: z
		.array(z.object({ content: z.string(), role: z.enum(["system", "user", "assistant"]) }))
		.min(1),
	model: z.string(),
	parameters: z.object({
		frequencyPenalty: z.number().min(-2).max(2).optional(),
		maxTokens: z.number().min(1).max(100_000).optional(),
		presencePenalty: z.number().min(-2).max(2).optional(),
		reasoningEffort: reasoningEffortSchema.optional(),
		temperature: z.number().min(0).max(2).optional().default(1),
		thinking: z.boolean().optional().default(false),
		thinkingExplicit: z.boolean().optional().default(false),
		topK: z.number().min(0).optional(),
		topP: z.number().min(0).max(1).optional(),
	}),
	providerId: z.string().optional(),
});

const runHandler = authed
	.use(requiredAdminMiddleware)
	.input(runInput)
	.handler(async ({ input, context }) => {
		const audioFiles = (input.audioFiles ?? []) as AudioFile[];
		const contextFiles = (input.contextFiles ?? []) as FillInputsContextFile[];
		validateScribeAudioFiles(audioFiles);
		validateScribeContextFiles(contextFiles);

		const resolved = input.providerId
			? await resolveProviderModel(input.providerId, input.model, context.db)
			: await resolveModelByRecordId(input.model, context.db);

		let messages: ModelMessage[] = input.messages;
		const reasoningEffort =
			input.parameters.reasoningEffort ?? (input.parameters.thinking ? "medium" : undefined);
		if (audioFiles.length > 0 || contextFiles.length > 0) {
			const attachmentsResult = await appendScribeInputAttachmentsToMessages({
				audioFiles,
				contextFiles,
				db: context.db,
				generationStrategy: {
					audio: { mode: "native" },
					files: contextFiles.some((file) => file.kind === "ocr")
						? {
								mode: "preprocess",
								selection: await resolveOcrSelection(context.db, context.session.user.id),
								strategy: "multimodal",
							}
						: { mode: "native" },
					generation: {
						defaultTemperature: null,
						model: resolved,
						reasoningEffort: reasoningEffort ?? "none",
						slot: "text",
					},
				},
				messages,
				userId: context.session.user.id,
				zdr: false,
			});
			({ messages } = attachmentsResult);
		}
		const providerOptions = buildProviderOptions({
			model: resolved,
			openRouterReasoningEffort: input.parameters.reasoningEffort === "none" ? "none" : undefined,
			reasoningEffort,
			userId: context.session.user.id,
		});

		let latestMetrics: AdminRunMetrics = {};
		const result = streamText({
			frequencyPenalty: input.parameters.frequencyPenalty,
			maxOutputTokens: input.parameters.maxTokens,
			messages,
			model: resolved.model,
			onStepFinish: (event) => {
				const openRouterUsage = extractOpenRouterUsage(
					event.providerMetadata as Record<string, unknown> | undefined,
				);

				latestMetrics = {
					cost: asFiniteNumber(openRouterUsage?.cost) ?? latestMetrics.cost,
					inputTokens:
						asFiniteNumber(openRouterUsage?.promptTokens) ??
						asFiniteNumber(event.usage.inputTokens) ??
						latestMetrics.inputTokens,
					outputTokens:
						asFiniteNumber(openRouterUsage?.completionTokens) ??
						asFiniteNumber(event.usage.outputTokens) ??
						latestMetrics.outputTokens,
					reasoningTokens:
						asFiniteNumber(openRouterUsage?.completionTokensDetails?.reasoningTokens) ??
						asFiniteNumber(event.usage.outputTokenDetails?.reasoningTokens) ??
						asFiniteNumber(event.usage.reasoningTokens) ??
						latestMetrics.reasoningTokens,
					totalTokens:
						asFiniteNumber(openRouterUsage?.totalTokens) ??
						asFiniteNumber(event.usage.totalTokens) ??
						latestMetrics.totalTokens,
				};
			},
			presencePenalty: input.parameters.presencePenalty,
			providerOptions,
			temperature: input.parameters.temperature,
			topK: input.parameters.topK,
			topP: input.parameters.topP,
		});

		return streamToEventIterator(
			result.toUIMessageStream({
				messageMetadata: ({ part }) => {
					if (part.type !== "finish") {
						return;
					}

					const metadata: AdminRunMetrics = {};

					const { cost } = latestMetrics;
					if (cost !== undefined) {
						metadata.cost = cost;
					}

					const inputTokens =
						latestMetrics.inputTokens ?? asFiniteNumber(part.totalUsage.inputTokens);
					if (inputTokens !== undefined) {
						metadata.inputTokens = inputTokens;
					}

					const outputTokens =
						latestMetrics.outputTokens ?? asFiniteNumber(part.totalUsage.outputTokens);
					if (outputTokens !== undefined) {
						metadata.outputTokens = outputTokens;
					}

					const reasoningTokens =
						latestMetrics.reasoningTokens ??
						asFiniteNumber(part.totalUsage.outputTokenDetails?.reasoningTokens) ??
						asFiniteNumber(part.totalUsage.reasoningTokens);
					if (reasoningTokens !== undefined) {
						metadata.reasoningTokens = reasoningTokens;
					}

					const totalTokens =
						latestMetrics.totalTokens ?? asFiniteNumber(part.totalUsage.totalTokens);
					if (totalTokens !== undefined) {
						metadata.totalTokens = totalTokens;
					}

					return metadata;
				},
			}),
		);
	});

export const scribeHandler = {
	run: runHandler,
};
