import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { convertToModelMessages, stepCountIs, streamText } from "ai";

import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import { scheduleScribeUsageLogging } from "@/orpc/scribe/handlers/usage-logging";
import { buildProviderOptions, resolveDefaultModel } from "@/orpc/scribe/providers";

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
 * Documentation-agent chat. Text-only MVP: a tool-calling loop on the standard
 * (text) model that can rewrite individual doctor's-note sections via the
 * `editSection` tool. The client applies the edits and feeds the current letter
 * back with each turn.
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

		// MVP is text-only: always the standard model produces the answer.
		const generation = await resolveDefaultModel(context.db, "text");

		const providerOptions = buildProviderOptions({
			includeUsage: true,
			model: generation.model,
			reasoningEffort: generation.reasoningEffort,
			userId: context.session.user.id,
			zdr: entitlements.hasActiveSubscription,
		});

		const effectiveTemperature = generation.defaultTemperature ?? undefined;

		const modelMessages = await convertToModelMessages(input.messages);

		const tools = createAgentTools({
			activeSubscription: entitlements.hasActiveSubscription,
			db: context.db,
			generation,
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
