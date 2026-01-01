import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { database } from "@repo/database";
import { env } from "@repo/env";
import { type LanguageModel, type ModelMessage, streamText } from "ai";
import { Langfuse } from "langfuse";
import pgvector from "pgvector";
import { VoyageAIClient } from "voyageai";
import { authed } from "@/orpc";
import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
	type UsageInputData,
	type UsageMetadata,
} from "@/lib/usage-logging";
import { documentTypeConfigs } from "./config";
import { getUsage } from "./_lib/get-usage";
import type {
	AudioFile,
	DocumentType,
	ModelConfig,
	SupportedModel,
} from "./types";

const langfuse = new Langfuse();
const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

/**
 * Get OpenRouter model instance based on model ID
 */
function getModelInstance(modelId: string): {
	model: LanguageModel;
	supportsThinking: boolean;
	modelName: string;
} {
	const openrouter = createOpenRouter({
		apiKey: env.OPENROUTER_API_KEY as string,
	});

	switch (modelId as SupportedModel) {
		case "glm-4p6":
			return {
				model: openrouter("z-ai/glm-4.6"),
				supportsThinking: true,
				modelName: "z-ai/glm-4.6",
			};
		case "claude-opus-4.5":
			return {
				model: openrouter("anthropic/claude-opus-4.5"),
				supportsThinking: true,
				modelName: "anthropic/claude-opus-4.5",
			};
		case "gemini-3-pro":
			return {
				model: openrouter("google/gemini-3-pro-preview"),
				supportsThinking: true,
				modelName: "google/gemini-3-pro-preview",
			};
		case "gemini-3-flash":
			return {
				model: openrouter("google/gemini-3-flash-preview"),
				supportsThinking: true,
				modelName: "google/gemini-3-flash-preview",
			};
		default:
			return {
				model: openrouter("anthropic/claude-opus-4.5"),
				supportsThinking: true,
				modelName: "anthropic/claude-opus-4.5",
			};
	}
}

/**
 * Get actual model ID, handling 'auto' selection
 */
function getActualModel(modelId: string, hasAudio?: boolean): string {
	if (modelId === "auto") {
		return hasAudio ? "gemini-3-pro" : "claude-opus-4.5";
	}
	return modelId;
}

/**
 * Check subscription and usage limits
 */
async function checkUsageLimit(userId: string, session: { user: { id: string } }) {
	const subscriptions = await database.subscription.findMany({
		where: {
			referenceId: userId,
			status: { in: ["active", "trialing"] },
		},
	});

	const activeSubscription = subscriptions.length > 0;
	const { usage } = await getUsage(session as { user: { id: string } });
	const usageLimit = activeSubscription ? 500 : 50;

	if (usage.count >= usageLimit) {
		throw new ORPCError("FORBIDDEN", {
			message:
				"Monatliche Nutzungsgrenze erreicht - passe dein Abonnement an",
		});
	}

	return { activeSubscription, usage };
}

/**
 * Generate embeddings using Voyage AI
 */
async function generateEmbeddings(content: string): Promise<number[]> {
	const result = await voyageClient.embed({
		input: content,
		model: "voyage-3-large",
	});
	return result.data?.[0]?.embedding ?? [];
}

/**
 * Find relevant templates for procedures using vector similarity
 */
async function findRelevantTemplateForProcedure(
	procedureNotes: string,
): Promise<string> {
	const embedding = await generateEmbeddings(procedureNotes);
	const embeddingSql = pgvector.toSql(embedding);

	interface TemplateResult {
		content: string;
		similarity: number;
	}

	const similarityResults = await database.$queryRaw<TemplateResult[]>`
		SELECT
			content,
			(1 - (embedding <=> ${embeddingSql}::vector)) as similarity
		FROM "Template"
		WHERE embedding IS NOT NULL
		AND (1 - (embedding <=> ${embeddingSql}::vector)) > 0.6
		ORDER BY embedding <-> ${embeddingSql}::vector
		LIMIT 1
	`;

	if (similarityResults[0]?.content) {
		return `## Relevante Textbaustein-Vorlage (Referenz)

Nutze die folgende Vorlage als Beispiel eines Textbausteins. Dieser ist anhand der gegebenen Informationen ausgewählt und potenziell relevant, der Assistent baut also darauf auf. Bei Diskrepanzen, nutze auf jeden Fall die Informationen aus der Nutzereingabe!
${similarityResults[0].content}`;
	}

	return `## Standard-Textbausteine (Referenz)

<details>
<summary>ZVK-Anlage Vorlage</summary>

### Befund
Sonographische Darstellung der V. jugularis {% switch "Seite" %}{% case "rechts" %}rechts{% /case %}{% case "links" %}links{% /case %}{% /switch %} und Markierung der Punktionsstelle, Desinfektion, steriles Abdecken, Lokalanästhesie mit {% info "Mecain-Volumen" /%} ml 1% Mecainlösung. Primär komplikationslose Anlage eines {% info "Lumen-Anzahl" /%}-lumigen zentralen Venenkatheters unter sonographischer Sicht. Aspiration von Blut aus allen Schenkeln problemlos möglich. Spülung, A-Naht.

### Beurteilung
Primär komplikationslose ZVK-Anlage {% switch "Seite" %}{% case "rechts" %}rechts{% /case %}{% case "links" %}links{% /case %}{% /switch %} jugulär.

### Empfehlung
Röntgen-Lagekontrolle erforderlich, anschließend Freigabe zur ZVK-Nutzung.

</details>

<details>
<summary>Kardioversion Vorlage</summary>

### Befund
Vorstellung zur elektrischen Kardioversion bei symptomatischem Vorhofflimmern. Vorheriges TEE ohne Thrombusnachweis, sichere Antikoagulation. Nach Aufklärung und erneutem Einverständnis erfolgte Sedierung mit {% info "Propofol-Dosis" /%} mg Propofol (1%). Elektrische Kardioversion mit {% info "Joule-Energie" /%} Joule (antero-laterale Elektrodenposition, 1. Schockabgabe).

### Beurteilung
Erfolgreiche Kardioversion in stabilen Sinusrhythmus.

### Empfehlung
EKG-Kontrolle, Monitoring, Antikoagulation fortführen.

</details>

<details>
<summary>Thoraxdrainage Vorlage</summary>

### Befund
Nach Desinfektion, sterilem Abdecken und Lokalanästhesie mit {% info "Mecain-Volumen" /%} ml 1% Mecainlösung primär komplikationslose Anlage einer {% info "Drainagegröße" /%} Chr Thoraxdrainage in Bülau-Position {% switch "Seite" %}{% case "rechts" %}rechts{% /case %}{% case "links" %}links{% /case %}{% /switch %}. Einzelknopfnaht der Hautwunde, U-Naht mit Drainage-Fixierung.

### Beurteilung
Komplikationslose Thoraxdrainage-Anlage.

### Empfehlung
Röntgen-Kontrolle, Drainage-Monitoring, Fördermengen-Dokumentation.

</details>`;
}

/**
 * Scribe input type
 */
interface ScribeStreamInput {
	documentType: DocumentType;
	prompt: string;
	model?: SupportedModel;
	audioFiles?: AudioFile[];
}

/**
 * Main streaming handler for all scribe document types
 */
export const scribeStreamHandler = authed
	.input(type<ScribeStreamInput>())
	.handler(async ({ input, context }) => {
		const { documentType, prompt, model = "auto", audioFiles } = input;

		// Validate document type
		const config = documentTypeConfigs[documentType];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${documentType}`,
			});
		}

		// Check user has stripeCustomerId
		if (!context.session.user.stripeCustomerId) {
			throw new ORPCError("UNAUTHORIZED", {
				message:
					"Du musst einen Stripe Account haben um diese Funktion zu nutzen.",
			});
		}

		// Check usage limits
		await checkUsageLimit(context.session.user.id, context.session);

		// Get actual model (handle 'auto')
		const hasAudio = audioFiles && audioFiles.length > 0;
		const actualModel = getActualModel(model, hasAudio);
		const { model: aiModel, supportsThinking, modelName } = getModelInstance(actualModel);

		// Process input based on document type
		let processedInput = config.processInput(prompt);

		// Special handling for procedures - add relevant template via vector search
		if (documentType === "procedures") {
			const parsed = JSON.parse(prompt);
			const relevantTemplate = await findRelevantTemplateForProcedure(
				parsed.procedureNotes,
			);
			processedInput = { ...processedInput, relevantTemplate };
		}

		// Get today's date for prompt compilation
		const todaysDate = new Date().toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

		// Get Langfuse prompt
		const textPrompt = await langfuse.getPrompt(config.promptName, undefined, {
			type: "chat",
			label:
				config.promptLabel ||
				(env.NODE_ENV === "production" ? "production" : "staging"),
		});

		// Compile prompt with variables
		const compiledPrompt = textPrompt.compile({
			...processedInput,
			todaysDate,
		});

		let messages: ModelMessage[] = compiledPrompt;

		// Handle audio files for Gemini models
		if (hasAudio && actualModel.startsWith("gemini")) {
			const lastMessage = messages.at(-1);
			if (lastMessage?.role === "user") {
				const audioContent = audioFiles.map((audioFile) => ({
					type: "file" as const,
					data: audioFile.data,
					mediaType: audioFile.mimeType,
				}));

				messages = [
					...messages.slice(0, -1),
					{
						...lastMessage,
						content: [
							{
								type: "text" as const,
								text:
									typeof lastMessage.content === "string"
										? lastMessage.content
										: "",
							},
							...audioContent,
						],
					},
				];
			}
		}

		// Build provider options for thinking mode
		const providerOptions: AnthropicProviderOptions = {};
		if (config.modelConfig.thinking && supportsThinking) {
			providerOptions.thinking = {
				type: "enabled",
				budgetTokens: config.modelConfig.thinkingBudget ?? 8000,
			};
		}

		// Stream the response
		const result = streamText({
			model: aiModel,
			maxOutputTokens: config.modelConfig.maxTokens ?? 20_000,
			temperature: config.modelConfig.temperature ?? 1,
			providerOptions: {
				openrouter: {
					usage: { include: true },
					user: context.session.user.email,
				},
			},
			messages,
			onFinish: async (event) => {
				// Extract OpenRouter usage data
				const openRouterUsage = extractOpenRouterUsage(event.providerMetadata);

				// Log usage to database
				await context.db.usageEvent.create({
					data: buildUsageEventData({
						userId: context.session.user.id,
						name: "ai_scribe_generation",
						model: modelName,
						openRouterUsage,
						standardUsage: event.usage as StandardUsage,
						inputData: processedInput as UsageInputData,
						metadata: {
							promptName: config.promptName,
							promptLabel:
								config.promptLabel ||
								(env.NODE_ENV === "production" ? "production" : "staging"),
							thinkingEnabled: config.modelConfig.thinking ?? false,
							thinkingBudget: config.modelConfig.thinking
								? config.modelConfig.thinkingBudget
								: undefined,
							streamingMode: true,
							endpoint: documentType,
							modelConfig: {
								maxTokens: config.modelConfig.maxTokens,
								temperature: config.modelConfig.temperature,
							},
						} as UsageMetadata,
						result: event.text,
						reasoning: event.reasoningText,
					}),
				});
			},
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
