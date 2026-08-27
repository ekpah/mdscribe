import type { Database } from "@repo/database";
import { generateText } from "ai";

import { getBase64Payload } from "@/lib/input-fill-limits";
import { AI_SCRIBE_STT_EVENT_NAME } from "@/lib/usage-event-names";
import type { StandardUsage } from "@/lib/usage-logging";
import { USER_MESSAGES } from "@/lib/user-messages";
import { SCRIBE_AUDIO_TRANSCRIPTION_PROMPT } from "@/orpc/scribe/prompts/core/audio-transcription";
import { buildProviderOptions } from "@/orpc/scribe/providers";
import type { ResolvedModel } from "@/orpc/scribe/providers";
import type { AudioFile } from "@/orpc/scribe/types";

import { logMediaPreprocessingUsage } from "./preprocessing-usage";

type AudioDeliveryStrategy = "native" | "transcription";
type AudioPreparationMode = "native" | "transcription";

interface PreparedAudioContentPart {
	data: Buffer;
	filename: string;
	mediaType: string;
	type: "file";
}

interface PreparedAudioInput {
	contentParts: PreparedAudioContentPart[];
	strategy: AudioDeliveryStrategy;
	transcripts: string[];
}

const OPENAI_CHAT_AUDIO_MEDIA_TYPES = new Set(["audio/mp3", "audio/mpeg", "audio/wav"]);

const OPENROUTER_AUDIO_MEDIA_TYPES = new Set([
	"audio/aac",
	"audio/aiff",
	"audio/flac",
	"audio/m4a",
	"audio/mp3",
	"audio/mp4",
	"audio/mpeg",
	"audio/ogg",
	"audio/pcm16",
	"audio/pcm24",
	"audio/wav",
]);

/**
 * Normalizes media types before handing them to AI SDK provider adapters.
 *
 * Browser recordings often include codec parameters such as
 * `audio/webm;codecs=opus`. The provider adapters branch on the base MIME type,
 * so stripping parameters prevents false incompatibilities while preserving the
 * actual container format.
 */
const normalizeAudioMediaType = (mimeType: string | undefined): string => {
	const baseType = mimeType?.split(";")[0]?.trim().toLowerCase();

	switch (baseType) {
		case "audio/x-wav":
		case "audio/wave": {
			return "audio/wav";
		}
		case "audio/x-m4a": {
			return "audio/m4a";
		}
		case "":
		case undefined: {
			return "audio/webm";
		}
		default: {
			return baseType;
		}
	}
};

const toBuffer = (data: string): Buffer => Buffer.from(getBase64Payload(data), "base64");

const createAudioPart = (
	data: string,
	mediaType: string,
	index: number,
): PreparedAudioContentPart => {
	const buffer = toBuffer(data);
	if (buffer.length === 0) {
		throw new Error(`Audioaufnahme ${index + 1} enthält keine Audiodaten.`);
	}

	return {
		data: buffer,
		filename: `aufnahme-${index + 1}.${mediaType.replace("audio/", "")}`,
		mediaType,
		type: "file",
	};
};

const getAudioFilename = (mediaType: string, index: number): string =>
	`aufnahme-${index + 1}.${mediaType.replace("audio/", "")}`;

const getAudioPayloadSummary = (audioFile: AudioFile, index: number) => ({
	index: index + 1,
	mediaType: audioFile.mimeType,
	payloadBytes: toBuffer(audioFile.data).length,
	wavFallbackBytes: audioFile.wavFallback ? toBuffer(audioFile.wavFallback.data).length : undefined,
});

const getWavFallbackPart = (
	audioFile: AudioFile,
	index: number,
): PreparedAudioContentPart | null => {
	if (!audioFile.wavFallback) {
		return null;
	}

	return createAudioPart(audioFile.wavFallback.data, "audio/wav", index);
};

const getUnsupportedAudioMessage = (mediaType: string, providerProtocol: string): string =>
	`Das Audioformat ${mediaType} wird vom Provider ${providerProtocol} in diesem Pfad nicht direkt unterstuetzt. Bitte erneut aufnehmen oder einen Audio-faehigen Provider waehlen.`;

/**
 * Selects the truthful audio variant for AI SDK native multimodal input.
 *
 * Gemini-like providers should receive the original browser recording when
 * possible. OpenAI/OpenAI-compatible chat adapters only accept WAV/MP3 audio,
 * while OpenRouter accepts several formats but not WebM. In those cases this
 * function uses the client-generated PCM WAV fallback instead of pretending
 * that the original bytes are WAV.
 */
const selectNativeAudioPart = (
	audioFile: AudioFile,
	resolvedModel: ResolvedModel,
	index: number,
): PreparedAudioContentPart => {
	const mediaType = normalizeAudioMediaType(audioFile.mimeType);

	if (resolvedModel.providerProtocol === "openrouter") {
		if (OPENROUTER_AUDIO_MEDIA_TYPES.has(mediaType)) {
			return createAudioPart(audioFile.data, mediaType, index);
		}

		const fallback = getWavFallbackPart(audioFile, index);
		if (fallback) {
			return fallback;
		}

		throw new Error(getUnsupportedAudioMessage(mediaType, "OpenRouter"));
	}

	if (
		resolvedModel.providerProtocol === "openai" ||
		resolvedModel.providerProtocol === "openai-compatible"
	) {
		if (OPENAI_CHAT_AUDIO_MEDIA_TYPES.has(mediaType)) {
			return createAudioPart(audioFile.data, mediaType, index);
		}

		const fallback = getWavFallbackPart(audioFile, index);
		if (fallback) {
			return fallback;
		}

		throw new Error(getUnsupportedAudioMessage(mediaType, resolvedModel.providerProtocol));
	}

	return createAudioPart(audioFile.data, mediaType, index);
};

/**
 * Transcribes audio with a dedicated speech-to-text model.
 *
 * This path is used when the configured audio model exposes an AI SDK
 * transcription interface, such as OpenAI `whisper-1` or `gpt-4o-transcribe`.
 * The original browser recording is preferred because transcription endpoints
 * accept a broader set of containers than chat/audio adapters.
 */
const transcribeAudioFiles = async (
	audioFiles: AudioFile[],
	resolvedModel: ResolvedModel,
	options?: {
		db?: Database;
		userId?: string;
		zdr?: boolean;
	},
): Promise<string[]> => {
	if (!resolvedModel.transcribeAudio) {
		throw new Error(USER_MESSAGES.audioNotSupported);
	}

	const transcripts = await Promise.all(
		audioFiles.map(async (audioFile, index) => {
			const mediaType = normalizeAudioMediaType(audioFile.mimeType);
			const requestStartedAt = Date.now();
			const result = (await resolvedModel.transcribeAudio?.({
				data: toBuffer(audioFile.data),
				filename: getAudioFilename(mediaType, index),
				mediaType,
			})) as
				| Awaited<ReturnType<NonNullable<ResolvedModel["transcribeAudio"]>>>
				| string
				| undefined;
			const timeToCompletionMs = Date.now() - requestStartedAt;
			const transcript = typeof result === "string" ? result.trim() : (result?.text.trim() ?? "");
			await logMediaPreprocessingUsage({
				db: options?.db,
				inputData: {
					audioFiles: [getAudioPayloadSummary(audioFile, index)],
				},
				isOpenRouter: resolvedModel.isOpenRouter,
				metadata: {
					credentialSource: resolvedModel.credentialSource,
					endpoint: "stt:direct",
					promptLabel: "stt:direct",
					promptName: "stt:direct",
					providerProtocol: resolvedModel.providerProtocol,
					strategy: "direct",
				},
				modelName: resolvedModel.modelName,
				name: AI_SCRIBE_STT_EVENT_NAME,
				providerMetadata: typeof result === "string" ? undefined : result?.providerMetadata,
				result: transcript,
				standardUsage:
					typeof result === "string" ? undefined : (result?.usage as StandardUsage | undefined),
				timing: { timeToCompletionMs },
				userId: options?.userId,
				zdr: options?.zdr,
			});
			return transcript;
		}),
	);

	return transcripts.filter(Boolean);
};

/**
 * Transcribes audio with a prompted multimodal chat model.
 *
 * Used when the speech-to-text slot is configured in multimodal mode: the
 * recordings are attached natively to a single chat request together with a
 * transcription prompt, and the response text is used as the transcript. This
 * allows on-prem or general multimodal models without a dedicated STT endpoint
 * to act as transcription models, including domain steering via the prompt.
 */
export const transcribeAudioFilesWithPrompt = async ({
	audioFiles,
	db,
	prompt,
	resolvedModel,
	userId,
	zdr,
}: {
	audioFiles: AudioFile[];
	db?: Database;
	prompt?: string;
	resolvedModel: ResolvedModel;
	userId?: string;
	zdr?: boolean;
}): Promise<string[]> => {
	const promptText = prompt?.trim() || SCRIBE_AUDIO_TRANSCRIPTION_PROMPT;
	const contentParts = audioFiles.map((audioFile, index) =>
		selectNativeAudioPart(audioFile, resolvedModel, index),
	);

	const requestStartedAt = Date.now();
	const result = await generateText({
		messages: [
			{
				content: [{ text: promptText, type: "text" }, ...contentParts],
				role: "user",
			},
		],
		model: resolvedModel.model,
		providerOptions: buildProviderOptions({
			includeUsage: true,
			model: resolvedModel,
			userId,
			zdr,
		}),
	});
	const timeToCompletionMs = Date.now() - requestStartedAt;

	const transcript = result.text.trim();
	await logMediaPreprocessingUsage({
		db,
		inputData: {
			audioFiles: audioFiles.map(getAudioPayloadSummary),
		},
		isOpenRouter: resolvedModel.isOpenRouter,
		metadata: {
			credentialSource: resolvedModel.credentialSource,
			endpoint: "stt:prompt",
			promptLabel: "stt:prompt",
			promptName: "stt:prompt",
			providerProtocol: resolvedModel.providerProtocol,
			strategy: "multimodal",
		},
		modelName: resolvedModel.modelName,
		name: AI_SCRIBE_STT_EVENT_NAME,
		providerMetadata: (result as { providerMetadata?: Record<string, unknown> }).providerMetadata,
		result: transcript,
		standardUsage: result.usage as StandardUsage,
		timing: { timeToCompletionMs },
		userId,
		zdr,
	});
	return transcript ? [transcript] : [];
};

/**
 * Prepares recorded audio for the selected provider/model pair.
 *
 * The returned content parts are safe for direct `generateText`/`streamText`
 * multimodal prompts. When the configured model is a real transcription model,
 * this returns transcript text instead so the caller can switch to a normal text
 * model for document generation or input filling.
 */
export const prepareAudioInputForModel = async ({
	audioFiles,
	db,
	mode,
	resolvedModel,
	userId,
	zdr,
}: {
	audioFiles: AudioFile[];
	db?: Database;
	mode: AudioPreparationMode;
	resolvedModel: ResolvedModel;
	userId?: string;
	zdr?: boolean;
}): Promise<PreparedAudioInput> => {
	if (audioFiles.length === 0) {
		return {
			contentParts: [],
			strategy: "native",
			transcripts: [],
		};
	}

	if (mode === "transcription") {
		return {
			contentParts: [],
			strategy: "transcription",
			transcripts: await transcribeAudioFiles(audioFiles, resolvedModel, {
				db,
				userId,
				zdr,
			}),
		};
	}

	return {
		contentParts: audioFiles.map((audioFile, index) =>
			selectNativeAudioPart(audioFile, resolvedModel, index),
		),
		strategy: "native",
		transcripts: [],
	};
};

/**
 * Formats transcripts as a prompt block that downstream clinical prompts can
 * consume without needing to know whether the source was native audio or STT.
 */
export const formatAudioTranscriptsForPrompt = (transcripts: string[]): string => {
	if (transcripts.length === 0) {
		return "";
	}

	const transcriptEntries = transcripts
		.map((transcript, index) => `<aufnahme index="${index + 1}">\n${transcript}\n</aufnahme>`)
		.join("\n");

	return `<audio_transkripte>\n${transcriptEntries}\n</audio_transkripte>`;
};
