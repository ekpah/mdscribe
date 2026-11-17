import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { convertToModelMessages, stepCountIs, streamText } from "ai";

import { templateAgentFlag } from "@/flags";
import { AI_SCRIBE_AGENT_EVENT_NAME } from "@/lib/usage-event-names";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { requiredFlagMiddleware } from "@/orpc/middlewares/flags";
import {
	injectMediaIntoLastUserMessage,
	prepareAgentMedia,
} from "@/orpc/scribe-agent/lib/prepare-media";
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

export const templateAgentEditHandler = authed
	.use(requiredFlagMiddleware(templateAgentFlag))
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
			// Reasoning shares this budget with the reply. A full template rewrite after long
			// reasoning exceeded 12k, which ended the turn with neither text nor tool call.
			maxOutputTokens: 48_000,
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
			// Room for a few validation retries and the closing summary.
			stopWhen: stepCountIs(6),
			system: buildTemplateAgentSystemPrompt({
				content: input.content,
				examples: input.examples ?? [],
				information: input.information ?? "",
			}),
			temperature,
			tools: { updateTemplate: createUpdateTemplateTool() },
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
