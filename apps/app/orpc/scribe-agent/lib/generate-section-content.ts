import type { Database } from "@repo/database";
import { generateText } from "ai";
import type { JSONValue } from "ai";

import type { Session } from "@/lib/auth-types";
import { composeScribeContext } from "@/orpc/scribe/context";
import type { TemplateContextInput } from "@/orpc/scribe/context";
import { scheduleScribeUsageLogging } from "@/orpc/scribe/handlers/usage-logging";
import { formatAudioTranscriptsForPrompt } from "@/orpc/scribe/handlers/audio-input";
import {
	composePromptHarnessPrompt,
	getPromptHarnessLabel,
	getPromptHarnessTargetField,
} from "@/orpc/scribe/prompts";
import type { ResolvedDefaultModelSelection } from "@/orpc/scribe/providers";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

import type { ScribeAgentSection } from "../types";

const GENERATE_MAX_OUTPUT_TOKENS = 8000;
const GENERATE_ENDPOINT_PREFIX = "scribe-agent:generateSection";

interface GenerateSectionContentParams {
	db: Database;
	userId: string;
	sessionUser: Session["user"];
	generation: ResolvedDefaultModelSelection;
	providerOptions: Record<string, Record<string, JSONValue>> | undefined;
	temperature?: number;
	activeSubscription: boolean;
	/** The harness whose clinical prompt generates the section. */
	harness: PromptHarnessId;
	/** Raw notes / clinical input the section is generated from. */
	notes: string;
	/** Audio transcripts parsed on the agent turn, appended to notes for replayable usage logs. */
	audioTranscripts: string[];
	/** Text extracted from context files on the agent turn, appended to notes for replayable usage logs. */
	fileTextContext: string;
	/** File metadata summaries for usage logging; never raw bytes. */
	contextFileSummaries: Record<string, unknown>[];
	/**
	 * Sibling sections used as clinical context, passed explicitly so the
	 * dependency is visible at the call site (no hidden coupling). Each is keyed
	 * into the prompt by its canonical target field.
	 */
	contextSections: ScribeAgentSection[];
	/** Optional AI Vorlage template; falls back to the harness standard template. */
	template?: TemplateContextInput | null;
}

/**
 * Generate a single doctor's-note section with its clinical prompt harness,
 * reusing the exact scribe pipeline (context composition + harness prompt).
 *
 * Every call logs a `UsageEvent` so nested agent generations are billed and
 * attributed — there is no model usage here without a corresponding event.
 */
export const generateSectionContent = async (
	params: GenerateSectionContentParams,
): Promise<string> => {
	const formData: Record<string, unknown> = { notes: params.notes };
	for (const section of params.contextSections) {
		const targetField = getPromptHarnessTargetField(section.harness);
		if (section.content.trim().length > 0) {
			formData[targetField] = section.content;
		}
	}

	const { contextPrompt, contextXml } = composeScribeContext({
		formData,
		promptContextKey: params.harness,
		sessionUser: params.sessionUser,
		template: params.template ?? null,
	});

	const requestStartedAt = Date.now();
	const promptMessages = composePromptHarnessPrompt(params.harness, {
		contextPrompt,
		contextXml,
	});
	if (!promptMessages) {
		throw new Error(`Unknown prompt harness: ${params.harness}`);
	}

	const result = await generateText({
		maxOutputTokens: GENERATE_MAX_OUTPUT_TOKENS,
		messages: promptMessages,
		model: params.generation.model.model,
		providerOptions: params.providerOptions,
		temperature: params.temperature,
	});

	const parsedMediaSections = [
		params.audioTranscripts.length > 0
			? formatAudioTranscriptsForPrompt(params.audioTranscripts)
			: "",
		params.fileTextContext,
	].filter(Boolean);
	const baseNotes = typeof formData.notes === "string" ? formData.notes : "";
	const usageInputData = {
		...formData,
		...(params.contextFileSummaries.length > 0
			? { _contextFiles: params.contextFileSummaries }
			: {}),
		...(parsedMediaSections.length > 0
			? { notes: [baseNotes, ...parsedMediaSections].filter(Boolean).join("\n\n") }
			: {}),
	};

	scheduleScribeUsageLogging({
		activeSubscription: params.activeSubscription,
		db: params.db,
		endpoint: `${GENERATE_ENDPOINT_PREFIX}:${params.harness}`,
		event: {
			providerMetadata: result.providerMetadata,
			reasoningText: result.reasoningText,
			text: result.text,
			usage: result.usage,
		},
		inputData: usageInputData,
		isOpenRouter: params.generation.model.isOpenRouter,
		modelConfig: {
			maxTokens: GENERATE_MAX_OUTPUT_TOKENS,
			temperature: params.temperature,
		},
		modelName: params.generation.model.modelName,
		promptLabel: getPromptHarnessLabel(params.harness),
		promptName: params.harness,
		reasoningEffort:
			params.generation.model.isOpenRouter &&
			params.generation.model.supportsReasoning
				? params.generation.reasoningEffort
				: "none",
		timing: { timeToCompletionMs: Date.now() - requestStartedAt },
		userId: params.userId,
	});

	return result.text;
};
