import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import type { ModelMessage } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";

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
import type { ScribeAgentChatInput } from "./types";

// Each editSection/generateSection call is one step; allow a few plus a summary.

const AGENT_ENDPOINT = "scribe-agent";
const AGENT_PROMPT_LABEL = "Dokumentations-Agent";
const AGENT_MAX_OUTPUT_TOKENS = 8000;
// One step to (optionally) call editSection per section, plus a final summary.
const AGENT_MAX_STEPS = 6;

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

		const tools = createAgentTools({
			activeSubscription: entitlements.hasActiveSubscription,
			db: context.db,
			generation,
			preparedMedia,
			providerOptions,
			sections,
			sessionUser: context.session.user,
			temperature: effectiveTemperature,
			userId: context.session.user.id,
		});

		const requestStartedAt = Date.now();
		let firstTokenAt: number | undefined;

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
			},
			onFinish: (event) => {
				const completedAt = Date.now();
				scheduleScribeUsageLogging({
					activeSubscription: entitlements.hasActiveSubscription,
					db: context.db,
					endpoint: AGENT_ENDPOINT,
					event,
					// Clinical text stays out of UsageEvent input; only metadata.
					inputData: {
						audioFiles: preparedMedia.audioSummaries,
						contextFiles: preparedMedia.fileSummaries,
						generationStrategy: {
							audioMode: preparedMedia.audioMode,
							fileMode: preparedMedia.fileMode,
							usedFilePreprocessing: preparedMedia.usedFilePreprocessing,
							usedNativeAudio: preparedMedia.usedNativeAudio,
							usedTranscription: preparedMedia.usedTranscription,
								usesStandardModel: agentStrategy.usesStandardModel,
						},
						messageCount: input.messages.length,
						sectionIds: sections.map((section) => section.id),
					},
					isOpenRouter: generation.model.isOpenRouter,
					modelConfig: {
						maxTokens: AGENT_MAX_OUTPUT_TOKENS,
						temperature: effectiveTemperature,
					},
					modelName: generation.model.modelName,
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
					userId: context.session.user.id,
				});
			},
			providerOptions,
			stopWhen: stepCountIs(AGENT_MAX_STEPS),
			system: buildAgentSystemPrompt(sections),
			temperature: effectiveTemperature,
			tools,
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
