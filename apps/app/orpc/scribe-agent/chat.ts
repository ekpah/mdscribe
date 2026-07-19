import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import type { ModelMessage } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";

import { AI_SCRIBE_AGENT_EVENT_NAME } from "@/lib/usage-event-names";
import { finishUsageTrace, startUsageTrace } from "@/lib/usage-tracing";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import { scheduleScribeUsageLogging } from "@/orpc/scribe/handlers/usage-logging";
import { buildProviderOptions, resolveAgentGenerationStrategy } from "@/orpc/scribe/providers";

import { prepareAgentMedia } from "./lib/prepare-media";
import type { PreparedAgentMedia } from "./lib/prepare-media";
import { buildAgentSystemPrompt } from "./prompt";
import { createAgentTools } from "./tools";
import type { AgentToolTraceEntry } from "./tools/shared";
import type { ScribeAgentChatInput } from "./types";

// Each editSection/generateSection call is one step; allow a few plus a summary.

const AGENT_ENDPOINT = "scribe-agent";
const AGENT_PROMPT_LABEL = "Dokumentations-Agent";
const AGENT_MAX_OUTPUT_TOKENS = 8000;
// One step to (optionally) call editSection per section, plus a final summary.
const AGENT_MAX_STEPS = 6;

const buildAgentUsageInputData = ({
	input,
	media,
}: {
	input: ScribeAgentChatInput;
	media: PreparedAgentMedia;
}): Record<string, unknown> => {
	const inputData: Record<string, unknown> = {
		audioFiles: media.audioSummaries,
		contextFiles: media.fileSummaries,
		messageCount: input.messages.length,
	};
	if (media.audioMode) {
		inputData.audioMode = media.audioMode;
	}
	if (media.fileMode) {
		inputData.fileMode = media.fileMode;
	}
	return inputData;
};

/**
 * Appends the prepared media to the latest user turn so the standard model sees
 * it alongside the instruction: injected transcripts/extracted text as a text
 * part, and native recordings/files as file parts. Earlier turns are left
 * untouched — attachments belong to the message that carried them.
 */
const injectMediaIntoLastUserMessage = (
	messages: ModelMessage[],
	media: PreparedAgentMedia,
): ModelMessage[] => {
	if (media.injectedTextBlocks.length === 0 && media.nativeContentParts.length === 0) {
		return messages;
	}

	const lastIndex = messages.length - 1;
	const lastMessage = messages[lastIndex];
	if (!lastMessage || lastMessage.role !== "user") {
		return messages;
	}

	const baseParts =
		typeof lastMessage.content === "string"
			? [{ text: lastMessage.content, type: "text" as const }]
			: lastMessage.content;

	const injectedTextParts =
		media.injectedTextBlocks.length > 0
			? [{ text: media.injectedTextBlocks.join("\n\n"), type: "text" as const }]
			: [];

	const next = [...messages];
	next[lastIndex] = {
		...lastMessage,
		content: [...baseParts, ...injectedTextParts, ...media.nativeContentParts],
	} as ModelMessage;
	return next;
};

/**
 * Documentation-agent chat. A tool-calling loop on the standard (text) model
 * that can rewrite individual doctor's-note sections via the `editSection` /
 * `generateSection` tools. The client applies the edits and feeds the current
 * letter back with each turn. Audio/file attachments on a turn are prepared
 * through the shared scribe media pipeline (native when the standard model
 * supports the kind, otherwise slot preprocessing into text).
 */
export const scribeAgentChatHandler = authed
	.use(scribeEntitlementsMiddleware)
	.input(type<ScribeAgentChatInput>())
	.handler(async ({ input, context }) => {
		const sections = input.sections ?? [];
		if (!input.messages || input.messages.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.missingInput,
			});
		}

		const { entitlements } = await enforceScribeUsageLimit({
			db: context.db,
			entitlements: context.entitlements.scribe,
			session: context.session,
		});

		// The admin can let the standard model run the agent or configure a
		// dedicated MDScribe Agent model.
		const agentStrategy = await resolveAgentGenerationStrategy(context.db, {
			hasAudio: (input.audioFiles?.length ?? 0) > 0,
			hasFiles: (input.contextFiles?.length ?? 0) > 0,
		});
		const { generation } = agentStrategy;

		const providerOptions = buildProviderOptions({
			includeUsage: true,
			model: generation.model,
			reasoningEffort: generation.reasoningEffort,
			userId: context.session.user.id,
			zdr: entitlements.hasActiveSubscription,
		});

		const effectiveTemperature = generation.defaultTemperature ?? undefined;

		const preparedMedia = await prepareAgentMedia({
			audioFiles: input.audioFiles ?? [],
			contextFiles: input.contextFiles ?? [],
			db: context.db,
			userId: context.session.user.id,
			zdr: entitlements.hasActiveSubscription,
		});

		const modelMessages = injectMediaIntoLastUserMessage(
			await convertToModelMessages(input.messages),
			preparedMedia,
		);

		const agentRunId = crypto.randomUUID();
		const { observationId: rootObservationId, traceId } = await startUsageTrace({
			db: context.db,
			metadata: { eventType: "chat" },
			name: AGENT_ENDPOINT,
			userId: context.session.user.id,
		});
		const toolTrace: AgentToolTraceEntry[] = [];
		const tools = createAgentTools({
			activeSubscription: entitlements.hasActiveSubscription,
			agentRunId,
			audioFiles: input.audioFiles ?? [],
			contextFiles: input.contextFiles ?? [],
			db: context.db,
			generation,
			preparedMedia,
			providerOptions,
			rootObservationId,
			sections,
			session: context.session,
			temperature: effectiveTemperature,
			toolTrace,
			traceId,
			userId: context.session.user.id,
		});

		const requestStartedAt = Date.now();
		let firstTokenAt: number | undefined;
		const reasoningChunks: string[] = [];

		const result = streamText({
			maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS,
			messages: modelMessages,
			model: generation.model.model,
			onChunk: ({ chunk }) => {
				if (
					firstTokenAt === undefined &&
					(chunk.type === "text-delta" || chunk.type === "reasoning-delta") &&
					chunk.text.length > 0
				) {
					firstTokenAt = Date.now();
				}
				if (chunk.type === "reasoning-delta" && chunk.text.length > 0) {
					reasoningChunks.push(chunk.text);
				}
			},
			onFinish: (event) => {
				const completedAt = Date.now();
				const streamedReasoning = reasoningChunks.join("");
				scheduleScribeUsageLogging({
					activeSubscription: entitlements.hasActiveSubscription,
					db: context.db,
					endpoint: AGENT_ENDPOINT,
					event: {
						...event,
						reasoningText: event.reasoningText || streamedReasoning || undefined,
					},
					// Clinical text stays out of UsageEvent input; only metadata.
					inputData: buildAgentUsageInputData({ input, media: preparedMedia }),
					isOpenRouter: generation.model.isOpenRouter,
					modelConfig: {
						temperature: effectiveTemperature,
					},
					modelName: generation.model.modelName,
					name: AI_SCRIBE_AGENT_EVENT_NAME,
					observationId: rootObservationId,
					promptLabel: AGENT_PROMPT_LABEL,
					promptName: AGENT_ENDPOINT,
					reasoningEffort:
						generation.model.isOpenRouter && generation.model.supportsReasoning
							? generation.reasoningEffort
							: "none",
					timing: {
						timeToCompletionMs: completedAt - requestStartedAt,
						timeToFirstTokenMs:
							firstTokenAt === undefined
								? undefined
								: firstTokenAt - requestStartedAt,
					},
					traceId,
					usageMetadata: {
						agentEventType: "chat",
						agentModelSource: agentStrategy.usesStandardModel ? "standard" : "agent",
						agentRunId,
						...(toolTrace.length > 0 ? { agentToolTrace: toolTrace } : {}),
					},
					userId: context.session.user.id,
				});
				void finishUsageTrace({ db: context.db, status: "succeeded", traceId });
			},
			providerOptions,
			stopWhen: stepCountIs(AGENT_MAX_STEPS),
			system: buildAgentSystemPrompt(sections),
			temperature: effectiveTemperature,
			tools,
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
