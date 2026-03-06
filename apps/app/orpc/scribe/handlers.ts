import { ORPCError, streamToEventIterator, type } from "@orpc/server";
import {
	and,
	eq,
	inArray,
	sql,
	subscription,
	usageEvent,
} from "@repo/database";
import { database } from "@repo/database/client";
import { env } from "@repo/env";
import { streamText } from 'ai';
import type { ModelMessage, UIMessage } from 'ai';
import { after } from "next/server";
import pgvector from "pgvector";
import { VoyageAIClient } from "voyageai";

import { buildUsageEventData, extractOpenRouterUsage } from '@/lib/usage-logging';
import type { StandardUsage, UsageInputData, UsageMetadata } from '@/lib/usage-logging';
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { getUsage } from "./_lib/get-usage";
import { documentTypeConfigs } from "./config";
import { buildScribeContext, derivePatientContext } from "./context";
import { resolveModel } from "./providers";
import type { AudioFile, DocumentType, PromptVariables } from "./types";

const voyageClient = new VoyageAIClient({
	apiKey: env.VOYAGE_API_KEY as string,
});

const parsePromptPayload = (prompt: string): Record<string, unknown> => {
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
};

const hasNonEmptyInput = (value: unknown): boolean => {
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
};

const hasAnyInput = (payload: Record<string, unknown>): boolean => {
	for (const entry of Object.values(payload)) {
		if (hasNonEmptyInput(entry)) {
			return true;
		}
	}
	return false;
};

const hasFileLikeInput = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		for (const entry of value) {
			if (hasFileLikeInput(entry)) {
				return true;
			}
		}
		return false;
	}

	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;

		const mimeTypeValue = record.mimeType ?? record.mediaType;
		if (typeof mimeTypeValue === "string") {
			const mimeType = mimeTypeValue.toLowerCase();
			if (
				mimeType.startsWith("image/") ||
				mimeType.startsWith("application/pdf")
			) {
				return true;
			}
		}

		for (const entry of Object.values(record)) {
			if (hasFileLikeInput(entry)) {
				return true;
			}
		}
	}

	return false;
};

const scheduleAfter = (callback: () => Promise<void>): void => {
	const run = async () => {
		try {
			await callback();
		} catch (error) {
			// Usage logging should never break request handling or tests.
			console.error("Deferred usage logging failed:", error);
		}
	};

	try {
		after(run);
	} catch {
		// Fallback for non-request contexts (e.g. direct handler unit tests).
		void run();
	}
};

/**
 * Check subscription and usage limits
 */
const checkUsageLimit = async (
	userId: string,
	session: { user: { id: string } },
	db: typeof database,
) => {
	const subscriptions = await db
		.select()
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, userId),
				inArray(subscription.status, ["active", "trialing"]),
			),
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
};

/**
 * Generate embeddings using Voyage AI
 */
const generateEmbeddings = async (content: string): Promise<number[]> => {
	const result = await voyageClient.embed({
		input: content,
		model: "voyage-3-large",
	});
	return result.data?.[0]?.embedding ?? [];
};

/**
 * Find relevant templates for procedures using vector similarity
 */
const findRelevantTemplateForProcedure = async (
	notes: string,
): Promise<string> => {
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

			interface TemplateResult extends Record<string, unknown> {
				content: string;
				similarity: number;
			}

		const similarityResults = await database.execute<TemplateResult>(sql`
			SELECT
				content,
				(1 - (embedding <=> ${embeddingSql}::vector)) as similarity
			FROM "Template"
			WHERE embedding IS NOT NULL
			AND (1 - (embedding <=> ${embeddingSql}::vector)) > 0.6
			ORDER BY embedding <-> ${embeddingSql}::vector
			LIMIT 1
		`);

		if (similarityResults[0]?.content) {
			return `## Relevante Textbaustein-Vorlage (Referenz)

Nutze die folgende Vorlage als Beispiel eines Textbausteins. Dieser ist anhand der gegebenen Informationen ausgewählt und potenziell relevant, der Assistent baut also darauf auf. Bei Diskrepanzen, nutze auf jeden Fall die Informationen aus der Nutzereingabe!
${similarityResults[0].content}`;
		}
	} catch (error) {
		console.error("Failed to find relevant procedure template:", error);
	}

	return defaultTemplate;
};

/**
 * Scribe input type - uses UIMessage[] for AI SDK useChat compatibility
 */
interface ScribeStreamInput {
	documentType: DocumentType;
	messages: UIMessage[];
	audioFiles?: AudioFile[];
}

/**
 * Extract prompt text from the last user message
 */
const extractPromptFromMessages = (messages: UIMessage[]): string => {
	const lastUserMessage = messages.findLast((m) => m.role === "user");
	if (!lastUserMessage) {return "";}

	// Extract text from parts when available (AI SDK UIMessage)
	if (lastUserMessage.parts) {
		return lastUserMessage.parts
			.filter((p) => p.type === "text")
			.map((p) => (p as { type: "text"; text: string }).text)
			.join("");
	}

	// Fallback to content string if parts are not present
	if ("content" in lastUserMessage) {
		const {content} = (lastUserMessage as { content?: unknown });
		if (typeof content === "string") {
			return content;
		}
	}

	return "";
};

/**
 * Main streaming handler for all scribe document types
 */
export const scribeStreamHandler = authed
	.input(type<ScribeStreamInput>())
	.handler(async ({ input, context }) => {
		const { documentType, messages: inputMessages, audioFiles } = input;

		// Extract prompt from the last user message
		const prompt = extractPromptFromMessages(inputMessages);

		// Validate document type
		const config = documentTypeConfigs[documentType];
		if (!config) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Unknown document type: ${documentType}`,
			});
		}

		// Check usage limits
		const { activeSubscription } = await checkUsageLimit(
			context.session.user.id,
			context.session,
			context.db,
		);

		// Validate input
		const hasAudio = audioFiles && audioFiles.length > 0;
		const rawPrompt = parsePromptPayload(prompt);
		if (!hasAudio && !hasAnyInput(rawPrompt)) {
			throw new ORPCError("BAD_REQUEST", {
				message: USER_MESSAGES.missingInput,
			});
		}
		const hasFileInput = hasFileLikeInput(rawPrompt);

		// Resolve model from admin-configured defaults
		const resolved = await resolveModel(context.db, {
			requireAudio: hasAudio,
			requireFiles: hasFileInput,
		});

		const contextSources = [{ data: rawPrompt, kind: "form" as const }];
		let relevantTemplate: string | undefined;

		// Special handling for procedures - add relevant template via vector search
		if (documentType === "procedures") {
			const {notes} = derivePatientContext(contextSources);
			relevantTemplate = await findRelevantTemplateForProcedure(notes);
		}

		// Get today's date for prompt compilation
		const todaysDate = new Date().toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

		const { contextXml } = await buildScribeContext({
			sessionUser: context.session.user,
			sources: contextSources,
		});

		// Build prompt messages using local prompt function
		const promptVariables = {
			contextXml,
			relevantTemplate,
			todaysDate,
		} as PromptVariables;

		const compiledPrompt = config.prompt(promptVariables);

		let messages: ModelMessage[] = compiledPrompt;

		// Handle audio files — capability validated by resolveModel
		if (hasAudio && resolved.inputModes.includes("audio")) {
			const lastMessage = messages.at(-1);
			if (lastMessage?.role === "user") {
				const audioContent = audioFiles.map((audioFile) => ({
					data: audioFile.data,
					mediaType: audioFile.mimeType,
					type: "file" as const,
				}));

				messages = [
					...messages.slice(0, -1),
					{
						...lastMessage,
						content: [
							{
								text:
									typeof lastMessage.content === "string"
										? lastMessage.content
										: "",
								type: "text" as const,
							},
							...audioContent,
						],
					},
				];
			}
		}

		// Build provider options — only include OpenRouter-specific options when using OpenRouter
		const useThinking =
			config.modelConfig.thinking && resolved.supportsReasoning;
		const thinkingEnabled = useThinking;

		// Enable with budget when desired, otherwise omit entirely.
		// NEVER send { enabled: false } — some models require mandatory reasoning.
		const reasoningConfig = thinkingEnabled
			? { max_tokens: config.modelConfig.thinkingBudget ?? 8000 }
			: undefined;

		const providerOptions = resolved.isOpenRouter
			? {
					openrouter: {
						usage: { include: true },
						user: context.session.user.email,
						...(reasoningConfig && { reasoning: reasoningConfig }),
						...(activeSubscription && { zdr: true }),
					},
				}
			: undefined;

		// Stream the response
			const result = streamText({
				maxOutputTokens: config.modelConfig.maxTokens ?? 20_000,
				messages,
				model: resolved.model,
				onFinish: (event) => {
				// PERF: Use after() for non-blocking usage logging (faster stream completion)
				scheduleAfter(async () => {
					// Extract OpenRouter usage data (graceful fallback for non-OpenRouter)
					const openRouterUsage = resolved.isOpenRouter
						? extractOpenRouterUsage(event.providerMetadata)
						: undefined;
					// Log usage to database using Drizzle
					// Plus subscribers: skip content logging for privacy (ZDR)
					await context.db.insert(usageEvent).values(
						buildUsageEventData({
							inputData: activeSubscription
								? undefined
								: (rawPrompt as UsageInputData),
							metadata: {
									endpoint: documentType,
									modelConfig: {
									maxTokens: config.modelConfig.maxTokens,
									temperature: config.modelConfig.temperature,
								},
									promptName: config.promptName,
									promptSource: "local",
									streamingMode: true,
									thinkingBudget: useThinking
										? config.modelConfig.thinkingBudget
										: undefined,
								thinkingEnabled: useThinking ?? false,
								zdrEnabled: activeSubscription,
							} as UsageMetadata,
							model: resolved.modelName,
							name: "ai_scribe_generation",
							openRouterUsage,
							reasoning: activeSubscription
								? "[zdr - content redacted]"
								: event.reasoningText,
								result: activeSubscription
								? "[zdr - content redacted]"
								: event.text,
							standardUsage: event.usage as StandardUsage,
							userId: context.session.user.id,
						}),
					);
				});
			},
				providerOptions,
				temperature: config.modelConfig.temperature ?? 1,
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
