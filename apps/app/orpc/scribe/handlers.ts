import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import { database, sql, subscription, usageEvent } from "@repo/database";
import { env } from "@repo/env";
import {
	type LanguageModel,
	type ModelMessage,
	type UIMessage,
	streamText,
} from "ai";
import { after } from "next/server";
import pgvector from "pgvector";
import { VoyageAIClient } from "voyageai";

import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
	type UsageInputData,
	type UsageMetadata,
} from "@/lib/usage-logging";
import { authed } from "@/orpc";
import { getUsage } from "./_lib/get-usage";
import { buildScribeContext, derivePatientContext } from "./context";
import { documentTypeConfigs } from "./config";
import type {
	AudioFile,
	DocumentType,
	PromptVariables,
	SupportedModel,
} from "./types";

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

import { USER_MESSAGES } from "@/lib/user-messages";

function parsePromptPayload(prompt: string): Record<string, unknown> {
	if (!prompt.trim()) {
		return {};
	}
	try {
		const parsed = JSON.parse(prompt) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.inputInvalid,
			});
		}
		return parsed as Record<string, unknown>;
	} catch (error) {
		if (error instanceof ORPCError) {
			throw error;
		}
		throw new ORPCError("BAD_REQUEST", {
			message: USER_MESSAGES.inputInvalid,
		});
	}
}

function hasNonEmptyInput(value: unknown): boolean {
	if (typeof value === "string") {
		return value.trim().length > 0;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return true;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			if (hasNonEmptyInput(entry)) {
				return true;
			}
		}
		return false;
	}
	if (value && typeof value === "object") {
		for (const entry of Object.values(value as Record<string, unknown>)) {
			if (hasNonEmptyInput(entry)) {
				return true;
			}
		}
	}
	return false;
}

function hasAnyInput(payload: Record<string, unknown>): boolean {
	for (const entry of Object.values(payload)) {
		if (hasNonEmptyInput(entry)) {
			return true;
		}
	}
	return false;
}

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
async function checkUsageLimit(
	userId: string,
	session: { user: { id: string } },
	db: typeof database,
) {
	const subscriptions = await db
		.select()
		.from(subscription)
		.where(
			sql`${subscription.referenceId} = ${userId} AND ${subscription.status} IN ('active', 'trialing')`,
		);

	const activeSubscription = subscriptions.length > 0;
	const { usage } = await getUsage(session, db);
	const usageLimit = activeSubscription ? 500 : 50;

	if (usage.count >= usageLimit) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.usageLimitReached,
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
async function findRelevantTemplateForProcedure(notes: string): Promise<string> {
	const defaultTemplate = `## Standard-Textbausteine (Referenz)

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

	if (!notes.trim()) {
		return defaultTemplate;
	}

	try {
		const embedding = await generateEmbeddings(notes);
		const embeddingSql = pgvector.toSql(embedding);

		type TemplateResult = {
			content: string;
			similarity: number;
		};

		const similarityResults = await database.execute<TemplateResult>(sql`
			SELECT
				content,
				(1 - (embedding <=> ${sql.raw(embeddingSql)}::vector)) as similarity
			FROM "Template"
			WHERE embedding IS NOT NULL
			AND (1 - (embedding <=> ${sql.raw(embeddingSql)}::vector)) > 0.6
			ORDER BY embedding <-> ${sql.raw(embeddingSql)}::vector
			LIMIT 1
		`);

		if (similarityResults.rows[0]?.content) {
			return `## Relevante Textbaustein-Vorlage (Referenz)

Nutze die folgende Vorlage als Beispiel eines Textbausteins. Dieser ist anhand der gegebenen Informationen ausgewählt und potenziell relevant, der Assistent baut also darauf auf. Bei Diskrepanzen, nutze auf jeden Fall die Informationen aus der Nutzereingabe!
${similarityResults.rows[0].content}`;
		}
	} catch (error) {
		console.error("Failed to find relevant procedure template:", error);
	}

	return defaultTemplate;
}

/**
 * Scribe input type - uses UIMessage[] for AI SDK useChat compatibility
 */
interface ScribeStreamInput {
	documentType: DocumentType;
	messages: UIMessage[];
	model?: SupportedModel;
	audioFiles?: AudioFile[];
}

/**
 * Extract prompt text from the last user message
 */
function extractPromptFromMessages(messages: UIMessage[]): string {
	const lastUserMessage = messages.findLast((m) => m.role === "user");
	if (!lastUserMessage) return "";

	// Extract text from parts when available (AI SDK UIMessage)
	if (lastUserMessage.parts) {
		return lastUserMessage.parts
			.filter((p) => p.type === "text")
			.map((p) => (p as { type: "text"; text: string }).text)
			.join("");
	}

	// Fallback to content string if parts are not present
	if ("content" in lastUserMessage) {
		const content = (lastUserMessage as { content?: unknown }).content;
		if (typeof content === "string") {
			return content;
		}
	}

	return "";
}

/**
 * Main streaming handler for all scribe document types
 */
export const scribeStreamHandler = authed
	.input(type<ScribeStreamInput>())
	.handler(async ({ input, context }) => {
		const {
			documentType,
			messages: inputMessages,
			model = "auto",
			audioFiles,
		} = input;

		// Extract prompt from the last user message
		const prompt = extractPromptFromMessages(inputMessages);

		// Validate document type
		const config = documentTypeConfigs[documentType];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${documentType}`,
			});
		}

		// Check user has stripeCustomerId
		if (!context.session.user.stripeCustomerId) {
			throw new ORPCError("FORBIDDEN", {
				message: USER_MESSAGES.subscriptionRequired,
			});
		}

		// Check usage limits
		const { activeSubscription } = await checkUsageLimit(
			context.session.user.id,
			context.session,
			context.db,
		);

		// Get actual model (handle 'auto')
		const hasAudio = audioFiles && audioFiles.length > 0;
		const rawPrompt = parsePromptPayload(prompt);
		if (!hasAudio && !hasAnyInput(rawPrompt)) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.missingInput,
			});
		}
		const actualModel = getActualModel(model, hasAudio);
		const {
			model: aiModel,
			supportsThinking,
			modelName,
		} = getModelInstance(actualModel);

		const contextSources = [{ kind: "form" as const, data: rawPrompt }];
		let relevantTemplate: string | undefined;

		// Special handling for procedures - add relevant template via vector search
		if (documentType === "procedures") {
			const notes = derivePatientContext(contextSources).notes;
			relevantTemplate = await findRelevantTemplateForProcedure(notes);
		}

		// Get today's date for prompt compilation
		const todaysDate = new Date().toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

		const { contextXml } = await buildScribeContext({
			sources: contextSources,
			sessionUser: context.session.user,
		});

		// Build prompt messages using local prompt function
		const promptVariables = {
			todaysDate,
			contextXml,
			relevantTemplate,
		} as PromptVariables;

		const compiledPrompt = config.prompt(promptVariables);

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

		// Stream the response
		const result = streamText({
			model: aiModel,
			maxOutputTokens: config.modelConfig.maxTokens ?? 20_000,
			temperature: config.modelConfig.temperature ?? 1,
			providerOptions: {
				openrouter: {
					usage: { include: true },
					user: context.session.user.email,
					reasoning: config.modelConfig.thinking
						? { max_tokens: config.modelConfig.thinkingBudget ?? 8000 }
						: { enabled: false },
					...(activeSubscription && { zdr: true }),
				},
			},
			messages,
			onFinish: (event) => {
				// PERF: Use after() for non-blocking usage logging (faster stream completion)
				after(async () => {
					// Extract OpenRouter usage data
					const openRouterUsage = extractOpenRouterUsage(
						event.providerMetadata,
					);
					console.dir(event, { depth: 5 });
					// Log usage to database using Drizzle
					// Plus subscribers: skip content logging for privacy (ZDR)
					await context.db.insert(usageEvent).values(
						buildUsageEventData({
							userId: context.session.user.id,
							name: "ai_scribe_generation",
							model: modelName,
							openRouterUsage,
							standardUsage: event.usage as StandardUsage,
							inputData: activeSubscription
								? undefined
								: (rawPrompt as UsageInputData),
							metadata: {
								promptName: config.promptName,
								promptSource: "local",
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
								zdrEnabled: activeSubscription,
							} as UsageMetadata,
							result: activeSubscription
								? "[zdr - content redacted]"
								: event.text,
							reasoning: activeSubscription
								? "[zdr - content redacted]"
								: event.reasoningText,
						}),
					);
				});
			},
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
