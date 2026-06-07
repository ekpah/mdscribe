import { USER_MESSAGES } from "@/lib/user-messages";
import type { ResolvedModel } from "@/orpc/scribe/providers";
import type { AudioFile } from "@/orpc/scribe/types";

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

const toBuffer = (data: string): Buffer => Buffer.from(data, "base64");

const createAudioPart = (
	data: string,
	mediaType: string,
	index: number,
): PreparedAudioContentPart => ({
	data: toBuffer(data),
	filename: `aufnahme-${index + 1}.${mediaType.replace("audio/", "")}`,
	mediaType,
	type: "file",
});

const getAudioFilename = (mediaType: string, index: number): string =>
	`aufnahme-${index + 1}.${mediaType.replace("audio/", "")}`;

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
): Promise<string[]> => {
	if (!resolvedModel.transcribeAudio) {
		throw new Error(USER_MESSAGES.audioNotSupported);
	}

	const transcripts = await Promise.all(
		audioFiles.map(async (audioFile, index) => {
			const mediaType = normalizeAudioMediaType(audioFile.mimeType);
			const result = await resolvedModel.transcribeAudio?.({
				data: toBuffer(audioFile.data),
				filename: getAudioFilename(mediaType, index),
				mediaType,
			});
			return result?.trim() ?? "";
		}),
	);

	return transcripts.filter(Boolean);
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
	mode,
	resolvedModel,
}: {
	audioFiles: AudioFile[];
	mode: AudioPreparationMode;
	resolvedModel: ResolvedModel;
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
			transcripts: await transcribeAudioFiles(audioFiles, resolvedModel),
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
