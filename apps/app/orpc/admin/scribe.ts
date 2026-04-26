import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { aiDefaults, eq } from "@repo/database";
import { generateObject, streamText } from "ai";
import type { ModelMessage } from "ai";
import { z } from "zod";

import { extractOpenRouterUsage } from "@/lib/usage-logging";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { composeScribeContext } from "@/orpc/scribe/context";
import { DEFAULT_SCRIBE_MODEL_CONFIG } from "@/orpc/scribe/handlers/scribe-stream";
import {
	createPromptVariables,
	composeDocumentTypePrompt,
	documentTypeConfigs,
} from "@/orpc/scribe/prompts";
import { PLAYGROUND_EVALUATION_SYSTEM_PROMPT } from "@/orpc/scribe/prompts/core/evaluation";
import { resolveModelByRecordId, resolveProviderModel } from "@/orpc/scribe/providers";

const compilePromptInput = z.object({
	documentType: z.string(),
	promptJson: z.string().optional(),
	promptName: z.string().optional(),
	variables: z.record(z.string(), z.unknown()).optional(),
});

const parsePromptJson = (promptJson?: string): Record<string, unknown> => {
	if (!promptJson) {
		return {};
	}
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
};

interface PlaygroundRunMetrics {
	cost?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	reasoningTokens?: number;
}

const asFiniteNumber = (value: unknown): number | undefined => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	return value;
};

const compilePromptHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof compilePromptInput>>())
	.handler(async ({ input, context }) => {
		const parsed = compilePromptInput.parse(input);
		const config = documentTypeConfigs[parsed.documentType as keyof typeof documentTypeConfigs];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${parsed.documentType}`,
			});
		}

		const resolvedPromptName = parsed.promptName ?? config.promptName;

		const variablesUsed = parsed.variables ?? parsePromptJson(parsed.promptJson);
		const relevantTemplate =
			typeof variablesUsed.relevantTemplate === "string"
				? variablesUsed.relevantTemplate
				: undefined;

		const { contextPrompt, contextXml } = await composeScribeContext({
			formData: variablesUsed,
			promptContextKey: parsed.documentType,
			selectedTemplateReference: relevantTemplate,
			sessionUser: context.session.user,
		});
		const promptVariables = createPromptVariables({
			contextXml,
			relevantTemplate,
		});

		const compiledMessages = composeDocumentTypePrompt(
			parsed.documentType as keyof typeof documentTypeConfigs,
			{
				contextPrompt,
				contextXml,
				relevantTemplate,
			},
		);

		return {
			compiledMessages,
			promptSource: "local",
			promptVariables,
			resolvedPromptName,
			variablesUsed,
		};
	});

const runInput = z.object({
	compiledMessagesOverride: z
		.array(
			z.object({
				content: z.union([z.string(), z.array(z.unknown())]),
				role: z.enum(["system", "user", "assistant"]),
			}),
		)
		.optional(),
	// Backward compatibility while frontend payload migrates fully.
	connectionId: z.string().optional(),
	documentType: z.string(),
	model: z.string(),
	parameters: z.object({
		frequencyPenalty: z.number().min(-2).max(2).optional(),
		maxTokens: z.number().min(1).max(100_000).optional().default(4096),
		presencePenalty: z.number().min(-2).max(2).optional(),
		temperature: z.number().min(0).max(2).optional().default(1),
		thinking: z.boolean().optional().default(false),
		thinkingBudget: z.number().min(1000).max(50_000).optional().default(8000),
		thinkingExplicit: z.boolean().optional().default(false),
		topK: z.number().min(0).optional(),
		topP: z.number().min(0).max(1).optional(),
	}),
	promptJson: z.string().optional(),
	promptName: z.string().optional(),
	providerId: z.string().optional(),
	requestId: z.string(),
	variables: z.record(z.string(), z.unknown()).optional(),
});

const runHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof runInput>>())
	.handler(async ({ input, context }) => {
		const parsed = runInput.parse(input);
		const config = documentTypeConfigs[parsed.documentType as keyof typeof documentTypeConfigs];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${parsed.documentType}`,
			});
		}

		const variablesUsed = parsed.variables ?? parsePromptJson(parsed.promptJson);

		const providerId = parsed.providerId ?? parsed.connectionId;
		const resolved = providerId
			? await resolveProviderModel(providerId, parsed.model, context.db)
			: await resolveModelByRecordId(parsed.model, context.db);

		let messages: ModelMessage[];
		if (parsed.compiledMessagesOverride) {
			messages = parsed.compiledMessagesOverride as unknown as ModelMessage[];
		} else {
			const relevantTemplate =
				typeof variablesUsed.relevantTemplate === "string"
					? variablesUsed.relevantTemplate
					: undefined;
			const { contextPrompt, contextXml } = await composeScribeContext({
				formData: variablesUsed,
				promptContextKey: parsed.documentType,
				selectedTemplateReference: relevantTemplate,
				sessionUser: context.session.user,
			});

			messages = composeDocumentTypePrompt(
				parsed.documentType as keyof typeof documentTypeConfigs,
				{
					contextPrompt,
					contextXml,
					relevantTemplate,
				},
			);
		}

		const thinkingEnabled = parsed.parameters.thinking && resolved.supportsReasoning;
		const reasoningConfig = thinkingEnabled
			? { max_tokens: parsed.parameters.thinkingBudget }
			: undefined;

		const providerOptions = resolved.isOpenRouter
			? {
					openrouter: {
						user: context.session.user.email,
						...(reasoningConfig && {
							reasoning: reasoningConfig,
						}),
					},
				}
			: undefined;

		let latestMetrics: PlaygroundRunMetrics = {};
		const result = streamText({
			frequencyPenalty: parsed.parameters.frequencyPenalty,
			maxOutputTokens: parsed.parameters.maxTokens,
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
			presencePenalty: parsed.parameters.presencePenalty,
			providerOptions,
			temperature: parsed.parameters.temperature,
			topK: parsed.parameters.topK,
			topP: parsed.parameters.topP,
		});

		return streamToEventIterator(
			result.toUIMessageStream({
				messageMetadata: ({ part }) => {
					if (part.type !== "finish") {
						return undefined;
					}

					const metadata: PlaygroundRunMetrics = {};

					const cost = latestMetrics.cost;
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

const evaluateInput = z.object({
	documentType: z.string(),
	inputs: z.unknown(),
	response: z.string().min(1),
});

/**
 * Schema for the LLM's structured output.
 * totalScore is intentionally excluded: it is derived client-side as the
 * mean of category scores so the model cannot introduce validation errors
 * by returning a mismatched value.
 */
const evaluateOutputSchema = z.object({
	categories: z
		.array(
			z.object({
				comment: z.string(),
				name: z.string(),
				score: z.number().min(0).max(10),
			}),
		)
		.length(4),
	summary: z.string(),
});

const evaluateHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof evaluateInput>>())
	.handler(async ({ context, input }) => {
		const parsed = evaluateInput.safeParse(input);

		if (!parsed.success) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Ungültige Bewertungsanfrage: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
			});
		}
		const defaults = await context.db.query.aiDefaults.findFirst({
			where: eq(aiDefaults.id, "global"),
		});
		const evaluationModelRecordId = defaults?.defaultEvaluationModel;
		if (!evaluationModelRecordId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Kein Standard-Evaluationsmodell konfiguriert",
			});
		}

		const evaluationModel = await resolveModelByRecordId(evaluationModelRecordId, context.db);

		let evaluation;
		try {
			evaluation = await generateObject({
				model: evaluationModel.model,
				schema: evaluateOutputSchema,
				system: PLAYGROUND_EVALUATION_SYSTEM_PROMPT,
				prompt: `Bewerte folgende Ausgabe.

Dokumenttyp: ${parsed.data.documentType}

Eingaben:
${JSON.stringify(parsed.data.inputs, null, 2)}

Ausgabe:
${parsed.data.response}`,
				temperature: 0.3,
			});
		} catch (error) {
			if (error instanceof Error && error.name === "AI_NoObjectGeneratedError") {
				throw new ORPCError("BAD_REQUEST", {
					message: `Bewertung konnte nicht erzeugt werden: Das Modell hat keine gültige Struktur zurückgegeben. ${error.message}`,
				});
			}
			const details = error instanceof Error ? error.message : USER_MESSAGES.evaluationFailed;
			throw new ORPCError("INTERNAL", {
				message: `Bewertung fehlgeschlagen: ${details}`,
			});
		}

		const categories = evaluation.object.categories.map((category) => ({
			comment: category.comment,
			name: category.name,
			score: Number(category.score.toFixed(1)),
		}));

		const totalScore = Number(
			(
				categories.reduce((sum, category) => sum + category.score, 0) /
				Math.max(1, categories.length)
			).toFixed(1),
		);

		return {
			categories,
			summary: evaluation.object.summary,
			totalScore,
		};
	});

export const scribeHandler = {
	compilePrompt: compilePromptHandler,
	prompts: {
		get: authed
			.use(requiredAdminMiddleware)
			.input(type<{ name: string }>())
			.handler(({ input }) => {
				const entry = Object.entries(documentTypeConfigs).find(
					([_, config]) => config.promptName === input.name,
				);

				if (!entry) {
					throw new ORPCError("NOT_FOUND", {
						message: `Prompt not found: ${input.name}`,
					});
				}

				const [documentType, config] = entry;

				const previewDate = new Date().toLocaleDateString("de-DE", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
				});
				const previewContextXml = "<context>\n<patient_context></patient_context>\n</context>";
				const messages = composeDocumentTypePrompt(
					documentType as keyof typeof documentTypeConfigs,
					{
						contextPrompt: `Das heutige Datum ist der ${previewDate}.\n\n${previewContextXml}`,
						contextXml: previewContextXml,
						relevantTemplate: "[Relevante Vorlage]",
						todaysDate: previewDate,
					},
				);

				return {
					documentType,
					messages,
					modelConfig: DEFAULT_SCRIBE_MODEL_CONFIG,
					name: config.promptName,
					source: "local",
				};
			}),
		list: authed
			.use(requiredAdminMiddleware)
			.input(
				type<{
					query?: string;
					limit?: number;
				}>(),
			)
			.handler(({ input }) => {
				const allPromptNames = Object.values(documentTypeConfigs).map(
					(config) => config.promptName,
				);

				let filteredNames = allPromptNames;
				if (input.query?.trim()) {
					const query = input.query.trim().toLowerCase();
					filteredNames = allPromptNames.filter((name) => name.toLowerCase().includes(query));
				}

				const limit = input.limit ?? 200;
				return {
					items: filteredNames.slice(0, limit),
				};
			}),
	},
	evaluate: evaluateHandler,
	run: runHandler,
};
