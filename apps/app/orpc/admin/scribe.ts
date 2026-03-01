import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { type ModelMessage, streamText } from "ai";
import { z } from "zod";

import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
	type UsageInputData,
	type UsageMetadata,
} from "@/lib/usage-logging";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "../middlewares/admin";
import { documentTypeConfigs } from "../scribe/config";
import { buildScribeContext } from "../scribe/context";
import {
	resolveModelByRecordId,
	resolveProviderModel,
} from "../scribe/providers";
import type { PromptVariables } from "../scribe/types";

function todaysDateDE(): string {
	return new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

const compilePromptInput = z.object({
	documentType: z.string(),
	promptName: z.string().optional(),
	variables: z.record(z.unknown()).optional(),
	promptJson: z.string().optional(),
});

function parsePromptJson(promptJson?: string): Record<string, unknown> {
	if (!promptJson) return {};
	try {
		const parsed = JSON.parse(promptJson) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("Invalid prompt JSON");
		}
		return parsed as Record<string, unknown>;
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "Invalid prompt JSON",
		});
	}
}

const compilePromptHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof compilePromptInput>>())
	.handler(async ({ input, context }) => {
		const parsed = compilePromptInput.parse(input);
		const config =
			documentTypeConfigs[
				parsed.documentType as keyof typeof documentTypeConfigs
			];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${parsed.documentType}`,
			});
		}

		const resolvedPromptName = parsed.promptName ?? config.promptName;

		const variablesUsed =
			parsed.variables ?? parsePromptJson(parsed.promptJson);
		if (
			parsed.documentType === "procedures" &&
			typeof variablesUsed.relevantTemplate !== "string"
		) {
			variablesUsed.relevantTemplate = "";
		}

		const { contextXml } = await buildScribeContext({
			sources: [{ kind: "form", data: variablesUsed }],
			sessionUser: context.session.user,
		});

		const promptVariables = {
			...variablesUsed,
			todaysDate: todaysDateDE(),
			contextXml,
		} as PromptVariables;

		const compiledMessages = config.prompt(promptVariables);

		return {
			compiledMessages,
			resolvedPromptName,
			promptSource: "local",
			variablesUsed,
		};
	});

const runInput = z.object({
	requestId: z.string(),
	model: z.string(),
	providerId: z.string().optional(),
	// Backward compatibility while frontend payload migrates fully.
	connectionId: z.string().optional(),
	parameters: z.object({
		temperature: z.number().min(0).max(2).optional().default(1),
		maxTokens: z.number().min(1).max(100000).optional().default(4096),
		thinking: z.boolean().optional().default(false),
		thinkingExplicit: z.boolean().optional().default(false),
		thinkingBudget: z.number().min(1000).max(50000).optional().default(8000),
		topP: z.number().min(0).max(1).optional(),
		topK: z.number().min(0).optional(),
		frequencyPenalty: z.number().min(-2).max(2).optional(),
		presencePenalty: z.number().min(-2).max(2).optional(),
	}),
	documentType: z.string(),
	promptName: z.string().optional(),
	variables: z.record(z.unknown()).optional(),
	promptJson: z.string().optional(),
	compiledMessagesOverride: z
		.array(
			z.object({
				role: z.enum(["system", "user", "assistant"]),
				content: z.union([z.string(), z.array(z.unknown())]),
			}),
		)
		.optional(),
});

const runHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof runInput>>())
	.handler(async ({ input, context }) => {
		const parsed = runInput.parse(input);
		const config =
			documentTypeConfigs[
				parsed.documentType as keyof typeof documentTypeConfigs
			];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${parsed.documentType}`,
			});
		}

		const resolvedPromptName = parsed.promptName ?? config.promptName;
		const variablesUsed =
			parsed.variables ?? parsePromptJson(parsed.promptJson);
		if (
			parsed.documentType === "procedures" &&
			typeof variablesUsed.relevantTemplate !== "string"
		) {
			variablesUsed.relevantTemplate = "";
		}

		const providerId = parsed.providerId ?? parsed.connectionId;
		const resolved = providerId
			? await resolveProviderModel(providerId, parsed.model, context.db)
			: await resolveModelByRecordId(parsed.model, context.db);

		let messages: ModelMessage[];
		if (parsed.compiledMessagesOverride) {
			messages = parsed.compiledMessagesOverride as unknown as ModelMessage[];
		} else {
			const { contextXml } = await buildScribeContext({
				sources: [{ kind: "form", data: variablesUsed }],
				sessionUser: context.session.user,
			});

			const promptVariables = {
				...variablesUsed,
				todaysDate: todaysDateDE(),
				contextXml,
			} as PromptVariables;

			messages = config.prompt(promptVariables);
		}

		const startTime = Date.now();
		const thinkingEnabled =
			parsed.parameters.thinking && resolved.supportsReasoning;
		const reasoningConfig = thinkingEnabled
			? { max_tokens: parsed.parameters.thinkingBudget }
			: undefined;

		const providerOptions = resolved.isOpenRouter
			? {
					openrouter: {
						usage: { include: true },
						user: context.session.user.email,
						...(reasoningConfig && {
							reasoning: reasoningConfig,
						}),
					},
				}
			: undefined;

		const result = streamText({
			model: resolved.model,
			maxOutputTokens: parsed.parameters.maxTokens,
			temperature: parsed.parameters.temperature,
			topP: parsed.parameters.topP,
			topK: parsed.parameters.topK,
			frequencyPenalty: parsed.parameters.frequencyPenalty,
			presencePenalty: parsed.parameters.presencePenalty,
			providerOptions,
			messages,
			onFinish: async (event) => {
				const latencyMs = Date.now() - startTime;
				const openRouterUsage = resolved.isOpenRouter
					? extractOpenRouterUsage(event.providerMetadata)
					: undefined;

				await context.db.insert(usageEvent).values(
					buildUsageEventData({
						userId: context.session.user.id,
						name: "admin_scribe_playground",
						model: resolved.modelName,
						openRouterUsage,
						standardUsage: event.usage as StandardUsage,
						inputData: variablesUsed as UsageInputData,
						metadata: {
							requestId: parsed.requestId,
							promptName: resolvedPromptName,
							promptSource: "local",
							thinkingEnabled,
							thinkingBudget: thinkingEnabled
								? parsed.parameters.thinkingBudget
								: undefined,
							latencyMs,
							endpoint: parsed.documentType,
							modelConfig: {
								maxTokens: parsed.parameters.maxTokens,
								temperature: parsed.parameters.temperature,
								topP: parsed.parameters.topP,
								topK: parsed.parameters.topK,
								frequencyPenalty: parsed.parameters.frequencyPenalty,
								presencePenalty: parsed.parameters.presencePenalty,
							},
						} as UsageMetadata,
						result: event.text,
						reasoning: event.reasoningText,
					}),
				);
			},
		});

		return streamToEventIterator(result.toUIMessageStream());
	});

export const scribeHandler = {
	compilePrompt: compilePromptHandler,
	run: runHandler,
	prompts: {
		list: authed
			.use(requiredAdminMiddleware)
			.input(
				type<{
					query?: string;
					limit?: number;
				}>(),
			)
			.handler(async ({ input }) => {
				const allPromptNames = Object.values(documentTypeConfigs).map(
					(config) => config.promptName,
				);

				let filteredNames = allPromptNames;
				if (input.query?.trim()) {
					const query = input.query.trim().toLowerCase();
					filteredNames = allPromptNames.filter((name) =>
						name.toLowerCase().includes(query),
					);
				}

				const limit = input.limit ?? 200;
				return {
					items: filteredNames.slice(0, limit),
				};
			}),

		get: authed
			.use(requiredAdminMiddleware)
			.input(type<{ name: string }>())
			.handler(async ({ input }) => {
				const entry = Object.entries(documentTypeConfigs).find(
					([_, config]) => config.promptName === input.name,
				);

				if (!entry) {
					throw new ORPCError("NOT_FOUND", {
						message: `Prompt not found: ${input.name}`,
					});
				}

				const [documentType, config] = entry;

				const sampleVariables = {
					todaysDate: todaysDateDE(),
					anamnese: "[Anamnese]",
					befunde: "[Befunde]",
					diagnoseblock: "[Diagnoseblock]",
					notes: "[Notizen]",
					relevantTemplate: "[Relevante Vorlage]",
					contextXml: "<patient_context></patient_context>",
				} as PromptVariables;

				const messages = config.prompt(sampleVariables);

				return {
					name: config.promptName,
					documentType,
					source: "local",
					modelConfig: config.modelConfig,
					messages,
				};
			}),
	},
};
