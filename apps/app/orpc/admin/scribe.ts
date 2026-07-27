import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { generateObject, streamText } from "ai";
import type { ModelMessage } from "ai";
import { z } from "zod";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
	getBase64DecodedByteLength,
} from "@/lib/input-fill-limits";
import { extractOpenRouterUsage } from "@/lib/usage-logging";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { composeScribeContext } from "@/orpc/scribe/context";
import { parseSelectedTemplateReference } from "@/orpc/scribe/context/template";
import { resolveFallbackTemplateByContextKey } from "@/orpc/scribe/context/template/fallbacks";
import {
	prepareAudioInputForModel,
	transcribeAudioFilesWithPrompt,
} from "@/orpc/scribe/handlers/audio-input";
import {
	appendScribeInputAttachmentsToMessages,
	DEFAULT_SCRIBE_MODEL_CONFIG,
	validateScribeAudioFiles,
	validateScribeContextFiles,
} from "@/orpc/scribe/handlers/scribe-stream";
import {
	createPromptVariables,
	composeDocumentTypePrompt,
	documentTypeConfigs,
	getDocumentTypeByPromptName,
	getPromptHarnessLabel,
	getPromptHarnessReferences,
	getPromptHarnessTargetField,
	PROMPT_HARNESS_OPTIONS,
	resolvePromptHarnessId,
} from "@/orpc/scribe/prompts";
import {
	buildResponseComparisonPrompt,
	buildUsageEventEvaluationPrompt,
	PDQI_9_CATEGORY_NAMES,
	RESPONSE_COMPARISON_SYSTEM_PROMPT,
	USAGE_EVENT_EVALUATION_SYSTEM_PROMPT,
} from "@/orpc/scribe/prompts/core/evaluation";
import type { EvaluationPromptContext } from "@/orpc/scribe/prompts/core/evaluation";
import {
	buildProviderOptions,
	resolveDefaultModel,
	resolveModelByRecordId,
	resolveProviderModel,
} from "@/orpc/scribe/providers";
import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

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

const contextFileInputSchema = z.object({
	data: z.string().min(1),
	mimeType: z.string().min(1),
	name: z.string().min(1),
	size: z.number().nonnegative(),
});

const transcribeAudioInput = z.object({
	audioFiles: z.array(audioFileInputSchema).min(1).max(FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles),
	mode: z.enum(["transcription", "native"]).optional(),
	modelId: z.string().min(1).nullable().optional(),
	prompt: z.string().max(4000).optional(),
});

const asFiniteNumber = (value: unknown): number | undefined => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	return value;
};

const validateAudioPayload = (audioFiles: AudioFile[]): void => {
	if (audioFiles.length === 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Bitte zuerst eine Audioaufnahme erstellen.",
		});
	}

	if (audioFiles.length > FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles} Audioaufnahmen möglich.`,
		});
	}

	let totalPayloadBytes = 0;
	for (const [index, audioFile] of audioFiles.entries()) {
		const payloadBytes = getBase64DecodedByteLength(audioFile.data);
		const wavFallbackBytes = getBase64DecodedByteLength(audioFile.wavFallback?.data);
		const totalBytes = payloadBytes + wavFallbackBytes;
		totalPayloadBytes += totalBytes;

		if (payloadBytes === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Audioaufnahme ${index + 1} enthält keine Audiodaten.`,
			});
		}

		if (totalBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Aufnahme ${index + 1} ist zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
			});
		}
	}

	if (totalPayloadBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Audioaufnahmen sind zusammen zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)} möglich.`,
		});
	}
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

		const resolvedPromptName =
			getDocumentTypeByPromptName(parsed.promptName ?? parsed.documentType) ?? parsed.documentType;

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
	audioFiles: z.array(audioFileInputSchema).max(FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles).optional(),
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
	contextFiles: z
		.array(contextFileInputSchema)
		.max(FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles)
		.optional(),
	documentType: z.string(),
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
		const audioFiles = (parsed.audioFiles ?? []) as AudioFile[];
		const contextFiles = (parsed.contextFiles ?? []) as FillInputsContextFile[];
		validateScribeAudioFiles(audioFiles);
		validateScribeContextFiles(contextFiles);

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

		const reasoningEffort =
			parsed.parameters.reasoningEffort ?? (parsed.parameters.thinking ? "medium" : "none");
		if (audioFiles.length > 0 || contextFiles.length > 0) {
			const attachmentsResult = await appendScribeInputAttachmentsToMessages({
				audioFiles,
				contextFiles,
				db: context.db,
				generationStrategy: {
					audio: { mode: "native" },
					files: { mode: "native" },
					generation: {
						defaultTemperature: null,
						model: resolved,
						reasoningEffort,
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
			reasoningEffort,
			userId: context.session.user.id,
		});

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
						return;
					}

					const metadata: PlaygroundRunMetrics = {};

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

const transcribeAudioHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof transcribeAudioInput>>())
	.handler(async ({ input, context }) => {
		const parsed = transcribeAudioInput.parse(input);
		const audioFiles = parsed.audioFiles as AudioFile[];
		validateAudioPayload(audioFiles);

		const mode = parsed.mode ?? "transcription";
		const modelSelection = parsed.modelId
			? {
					defaultTemperature: null,
					model: await resolveModelByRecordId(parsed.modelId, context.db),
					reasoningEffort: "none" as const,
					slot: "speech-to-text" as const,
				}
			: await resolveDefaultModel(context.db, "speech-to-text").catch((error: unknown) => {
					const details = error instanceof Error ? error.message : USER_MESSAGES.modelUnavailable;
					throw new ORPCError("BAD_REQUEST", {
						message: `Kein Audio-Transkriptionsmodell konfiguriert. (${details})`,
					});
				});

		if (mode === "native") {
			const transcripts = await transcribeAudioFilesWithPrompt({
				audioFiles,
				db: context.db,
				prompt: parsed.prompt,
				resolvedModel: modelSelection.model,
				userId: context.session.user.id,
				zdr: false,
			}).catch((error: unknown) => {
				const details = error instanceof Error ? error.message : USER_MESSAGES.audioNotSupported;
				throw new ORPCError("BAD_REQUEST", {
					message: `Multimodale Transkription fehlgeschlagen. Bitte ein Audio-fähiges Modell wählen. (${details})`,
				});
			});

			const nativeTranscript = transcripts.join("\n\n").trim();
			if (!nativeTranscript) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Die Transkription hat keinen Text zurückgegeben.",
				});
			}

			return {
				modelName: modelSelection.model.modelName,
				transcript: nativeTranscript,
				transcripts,
			};
		}

		const preparedAudio = await prepareAudioInputForModel({
			audioFiles,
			db: context.db,
			mode: "transcription",
			resolvedModel: modelSelection.model,
			userId: context.session.user.id,
			zdr: false,
		}).catch((error: unknown) => {
			const details = error instanceof Error ? error.message : USER_MESSAGES.audioNotSupported;
			throw new ORPCError("BAD_REQUEST", {
				message: `Transkription fehlgeschlagen. (${details})`,
			});
		});

		const transcript = preparedAudio.transcripts.join("\n\n").trim();
		if (!transcript) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Die Transkription hat keinen Text zurückgegeben.",
			});
		}

		return {
			modelName: modelSelection.model.modelName,
			transcript,
			transcripts: preparedAudio.transcripts,
		};
	});

const evaluateResponseInput = z.object({
	documentType: z.string(),
	inputs: z.record(z.string(), z.unknown()),
	promptName: z.string().optional(),
	response: z.string().trim().min(1),
});

const responseEvaluationSchema = z.object({
	categories: z
		.array(
			z.object({
				comment: z.string(),
				name: z.enum(PDQI_9_CATEGORY_NAMES),
				score: z.number().int().min(1).max(5),
			}),
		)
		.length(9),
	summary: z.string(),
});

const resolvePlaygroundEvaluationPromptContext = ({
	documentType,
	inputs,
	promptName,
}: z.infer<typeof evaluateResponseInput>): EvaluationPromptContext | undefined => {
	const promptReference = promptName ?? documentType;
	const harnessId =
		resolvePromptHarnessId(promptReference) ?? resolvePromptHarnessId(documentType);
	if (!harnessId) {
		return undefined;
	}

	const templateReference =
		typeof inputs.relevantTemplate === "string" && inputs.relevantTemplate.trim().length > 0
			? inputs.relevantTemplate
			: undefined;
	const selectedTemplate = templateReference
		? parseSelectedTemplateReference(templateReference)
		: undefined;
	const fallbackTemplate = selectedTemplate
		? undefined
		: resolveFallbackTemplateByContextKey(harnessId);
	const promptTemplate = selectedTemplate ?? fallbackTemplate;

	return {
		harnessId,
		harnessInstructions: documentTypeConfigs[harnessId].systemPrompt,
		promptLabel: getPromptHarnessLabel(harnessId),
		targetField: getPromptHarnessTargetField(harnessId),
		template: promptTemplate
			? {
					content: promptTemplate.content,
					information: promptTemplate.information,
					source: selectedTemplate ? "selected" : "built-in",
					title: promptTemplate.title,
				}
			: undefined,
	};
};

const evaluateResponseHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof evaluateResponseInput>>())
	.handler(async ({ context, input }) => {
		const parsed = evaluateResponseInput.parse(input);
		const evaluationSelection = await resolveDefaultModel(context.db, "evaluation").catch(
			(error: unknown) => {
				const details = error instanceof Error ? error.message : USER_MESSAGES.modelUnavailable;
				throw new ORPCError("BAD_REQUEST", {
					message: `Kein Standard-Evaluationsmodell konfiguriert. (${details})`,
				});
			},
		);

		let evaluation;
		try {
			evaluation = await generateObject({
				model: evaluationSelection.model.model,
				prompt: buildUsageEventEvaluationPrompt({
					documentType: parsed.documentType,
					inputs: parsed.inputs,
					promptContext: resolvePlaygroundEvaluationPromptContext(parsed),
					response: parsed.response,
				}),
				providerOptions: buildProviderOptions({
					model: evaluationSelection.model,
					reasoningEffort: evaluationSelection.reasoningEffort,
					userId: context.session.user.id,
				}),
				schema: responseEvaluationSchema,
				system: USAGE_EVENT_EVALUATION_SYSTEM_PROMPT,
				temperature: evaluationSelection.defaultTemperature ?? undefined,
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

		const categories = evaluation.object.categories.map((category, index) => ({
			comment: category.comment,
			name: PDQI_9_CATEGORY_NAMES[index] ?? category.name,
			score: category.score,
		}));

		return {
			categories,
			evaluatedAt: new Date().toISOString(),
			instrument: "PDQI-9" as const,
			maxScore: 45,
			summary: evaluation.object.summary,
			totalScore: categories.reduce((total, category) => total + category.score, 0),
		};
	});

const comparisonSideSchema = z.enum(["a", "b"]);

const evaluateComparisonInput = z.object({
	documentType: z.string(),
	inputs: z.unknown(),
	responses: z.object({
		a: z.string().min(1),
		b: z.string().min(1),
	}),
});

const evaluateComparisonOutputSchema = z.object({
	note: z.string().min(1),
	preferredResponse: comparisonSideSchema,
});

const evaluateComparisonHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof evaluateComparisonInput>>())
	.handler(async ({ context, input }) => {
		const parsed = evaluateComparisonInput.safeParse(input);

		if (!parsed.success) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Ungültige Vergleichsbewertung: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
			});
		}

		const evaluationSelection = await resolveDefaultModel(context.db, "evaluation").catch(
			(error: unknown) => {
				const details = error instanceof Error ? error.message : USER_MESSAGES.modelUnavailable;
				throw new ORPCError("BAD_REQUEST", {
					message: `Kein Standard-Evaluationsmodell konfiguriert. (${details})`,
				});
			},
		);

		let comparison;
		try {
			comparison = await generateObject({
				model: evaluationSelection.model.model,
				prompt: buildResponseComparisonPrompt(parsed.data),
				providerOptions: buildProviderOptions({
					model: evaluationSelection.model,
					reasoningEffort: evaluationSelection.reasoningEffort,
					userId: context.session.user.id,
				}),
				schema: evaluateComparisonOutputSchema,
				system: RESPONSE_COMPARISON_SYSTEM_PROMPT,
				temperature: evaluationSelection.defaultTemperature ?? undefined,
			});
		} catch (error) {
			if (error instanceof Error && error.name === "AI_NoObjectGeneratedError") {
				throw new ORPCError("BAD_REQUEST", {
					message: `Vergleichsbewertung konnte nicht erzeugt werden: Das Modell hat keine gültige Struktur zurückgegeben. ${error.message}`,
				});
			}
			const details = error instanceof Error ? error.message : USER_MESSAGES.evaluationFailed;
			throw new ORPCError("INTERNAL", {
				message: `Vergleichsbewertung fehlgeschlagen: ${details}`,
			});
		}

		const note = comparison.object.note.trim();

		return {
			note: note.length > 240 ? `${note.slice(0, 237)}...` : note,
			preferredResponse: comparison.object.preferredResponse,
		};
	});

export const scribeHandler = {
	compilePrompt: compilePromptHandler,
	evaluateComparison: evaluateComparisonHandler,
	evaluateResponse: evaluateResponseHandler,
	prompts: {
		get: authed
			.use(requiredAdminMiddleware)
			.input(type<{ name: string }>())
			.handler(({ input }) => {
				const documentType = getDocumentTypeByPromptName(input.name);
				if (!documentType) {
					throw new ORPCError("NOT_FOUND", {
						message: `Prompt not found: ${input.name}`,
					});
				}

				const config = documentTypeConfigs[documentType];

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
					label: config.promptName,
					messages,
					modelConfig: DEFAULT_SCRIBE_MODEL_CONFIG,
					name: documentType,
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
				let filteredOptions = PROMPT_HARNESS_OPTIONS;
				if (input.query?.trim()) {
					const query = input.query.trim().toLowerCase();
					filteredOptions = PROMPT_HARNESS_OPTIONS.filter((option) =>
						getPromptHarnessReferences(option.id).some((reference) =>
							reference.toLowerCase().includes(query),
						),
					);
				}

				const limit = input.limit ?? 200;
				const options = filteredOptions.slice(0, limit);
				return {
					items: options.map((option) => option.id),
					options,
				};
			}),
	},
	run: runHandler,
	transcribeAudio: transcribeAudioHandler,
};
