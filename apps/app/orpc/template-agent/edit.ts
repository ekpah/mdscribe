import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import type { ModelMessage } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";

import { AI_SCRIBE_AGENT_EVENT_NAME } from "@/lib/usage-event-names";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { prepareAgentMedia } from "@/orpc/scribe-agent/lib/prepare-media";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import { scheduleScribeUsageLogging } from "@/orpc/scribe/handlers/usage-logging";
import {
	buildProviderOptions,
	isGenerationStrategyFullyByok,
	resolveAgentGenerationStrategy,
} from "@/orpc/scribe/providers";

import { buildTemplateAgentSystemPrompt } from "./prompt";
import type { TemplateAgentChatInput } from "./types";
import { createUpdateTemplateTool } from "./update-template-tool";

const injectMediaIntoLastUserMessage = (
	messages: ModelMessage[],
	media: Awaited<ReturnType<typeof prepareAgentMedia>>,
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
	const next = [...messages];
	next[lastIndex] = {
		...lastMessage,
		content: [
			...baseParts,
			...media.injectedTextBlocks.map((text) => ({ text, type: "text" as const })),
			...media.nativeContentParts,
		],
	} as ModelMessage;
	return next;
};

export const templateAgentEditHandler = authed
	.use(requiredAdminMiddleware)
	.use(scribeEntitlementsMiddleware)
	.input(type<TemplateAgentChatInput>())
	.handler(async ({ context, input }) => {
		if (!input.messages || input.messages.length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "Eine Nachricht ist erforderlich." });
		}

		const strategy = await resolveAgentGenerationStrategy(context.db, {
			hasAudio: (input.audioFiles?.length ?? 0) > 0,
			hasFiles: (input.contextFiles?.length ?? 0) > 0,
			userId: context.session.user.id,
		});
		const { entitlements } = await enforceScribeUsageLimit({
			db: context.db,
			entitlements: context.entitlements.scribe,
			isQuotaExempt: isGenerationStrategyFullyByok(strategy),
			session: context.session,
		});
		const { generation } = strategy;
		const providerOptions = buildProviderOptions({
			includeUsage: true,
			model: generation.model,
			reasoningEffort: generation.reasoningEffort,
			userId: context.session.user.id,
			zdr: entitlements.hasActiveSubscription,
		});
		const preparedMedia = await prepareAgentMedia({
			audioFiles: input.audioFiles ?? [],
			contextFiles: input.contextFiles ?? [],
			db: context.db,
			strategy,
			userId: context.session.user.id,
			zdr: entitlements.hasActiveSubscription,
		});
		const messages = injectMediaIntoLastUserMessage(
			await convertToModelMessages(input.messages),
			preparedMedia,
		);
		const temperature = generation.defaultTemperature ?? undefined;

		const result = streamText({
			maxOutputTokens: 12_000,
			messages,
			model: generation.model.model,
			onFinish: (event) => {
				scheduleScribeUsageLogging({
					activeSubscription: entitlements.hasActiveSubscription,
					db: context.db,
					endpoint: "template-agent",
					event,
					inputData: {
						audioFiles: preparedMedia.audioSummaries,
						contextFiles: preparedMedia.fileSummaries,
						messageCount: input.messages.length,
					},
					isOpenRouter: generation.model.isOpenRouter,
					modelConfig: { temperature },
					modelName: generation.model.modelName,
					name: AI_SCRIBE_AGENT_EVENT_NAME,
					promptLabel: "Template-Agent",
					promptName: "template-agent",
					reasoningEffort: generation.reasoningEffort,
					usageMetadata: {
						agentEventType: "chat",
						agentModelSource: strategy.usesStandardModel ? "standard" : "agent",
						credentialSource: generation.model.credentialSource,
						providerProtocol: generation.model.providerProtocol,
					},
					userId: context.session.user.id,
				});
			},
			providerOptions,
			stopWhen: stepCountIs(4),
			system: buildTemplateAgentSystemPrompt(input.content),
			temperature,
			tools: { updateTemplate: createUpdateTemplateTool() },
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
