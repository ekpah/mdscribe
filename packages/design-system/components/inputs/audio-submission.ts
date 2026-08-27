"use client";

interface AudioSubmissionFile {
	data: string;
	mimeType: string;
	wavFallback?: {
		data: string;
		mimeType: "audio/wav";
	};
}

type AudioContextConstructor = typeof AudioContext;

interface WindowWithWebkitAudioContext extends Window {
	AudioContext?: AudioContextConstructor;
	webkitAudioContext?: AudioContextConstructor;
}

const encodeUint8ArrayToBase64 = (data: Uint8Array): string => {
	const chunkSize = 8192;
	const chunks: string[] = [];

	for (let i = 0; i < data.length; i += chunkSize) {
		const chunk = data.subarray(i, i + chunkSize);
		chunks.push(String.fromCodePoint(...chunk));
	}

	return btoa(chunks.join(""));
};

export const blobToBase64 = async (blob: Blob): Promise<string> => {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	return encodeUint8ArrayToBase64(bytes);
};

const getAudioContextConstructor = (): AudioContextConstructor | null => {
	const typedWindow = window as WindowWithWebkitAudioContext;
	return typedWindow.AudioContext ?? typedWindow.webkitAudioContext ?? null;
};

const writeAscii = (view: DataView, offset: number, value: string) => {
	for (let index = 0; index < value.length; index += 1) {
		view.setUint8(offset + index, value.codePointAt(index) ?? 0);
	}
};

const writePcmSample = (view: DataView, offset: number, sample: number) => {
	const clamped = Math.max(-1, Math.min(1, sample));
	const scaled = clamped < 0 ? clamped * 0x80_00 : clamped * 0x7f_ff;
	view.setInt16(offset, scaled, true);
};

/**
 * Encodes decoded browser audio into a plain PCM16 WAV blob.
 *
 * The browser recorder may produce WebM/Opus, which is excellent for local
 * capture and playback but is not accepted by every AI SDK provider adapter.
 * A small uncompressed WAV fallback gives the server a truthful compatibility
 * option without relabeling WebM bytes as WAV.
 */
const encodeAudioBufferToPcmWav = (audioBuffer: AudioBuffer): Blob => {
	const channelCount = audioBuffer.numberOfChannels;
	const frameCount = audioBuffer.length;
	const { sampleRate } = audioBuffer;
	const bytesPerSample = 2;
	const blockAlign = channelCount * bytesPerSample;
	const byteRate = sampleRate * blockAlign;
	const dataSize = frameCount * blockAlign;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	writeAscii(view, 0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeAscii(view, 8, "WAVE");
	writeAscii(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channelCount, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bytesPerSample * 8, true);
	writeAscii(view, 36, "data");
	view.setUint32(40, dataSize, true);

	const channelData = Array.from({ length: channelCount }, (_, channel) =>
		audioBuffer.getChannelData(channel),
	);
	let offset = 44;
	for (let frame = 0; frame < frameCount; frame += 1) {
		for (let channel = 0; channel < channelCount; channel += 1) {
			writePcmSample(view, offset, channelData[channel]?.[frame] ?? 0);
			offset += bytesPerSample;
		}
	}

	return new Blob([buffer], { type: "audio/wav" });
};

/**
 * Builds a WAV fallback for a recorded blob when the browser can decode it.
 *
 * This runs only in the browser because it uses Web Audio. Returning `null`
 * keeps submission resilient: providers that can consume the original format
 * still receive it, while providers that require WAV can surface a clear server
 * error if the fallback could not be produced.
 */
const createWavFallback = async (blob: Blob): Promise<Blob | null> => {
	const AudioContextClass = getAudioContextConstructor();
	if (!AudioContextClass) {
		return null;
	}

	const context = new AudioContextClass();
	try {
		const decodedAudio = await context.decodeAudioData(await blob.arrayBuffer());
		return encodeAudioBufferToPcmWav(decodedAudio);
	} catch {
		return null;
	} finally {
		await context.close().catch(() => null);
	}
};

const isWavMimeType = (mimeType: string): boolean => {
	const normalized = mimeType.split(";")[0]?.trim().toLowerCase();
	return normalized === "audio/wav" || normalized === "audio/x-wav";
};

/**
 * Creates the wire payload for recorded audio.
 *
 * The original blob is always preserved so native multimodal models, such as
 * Gemini, can receive the browser's actual recording format. A WAV fallback is
 * added opportunistically for OpenAI/OpenAI-compatible/OpenRouter paths that
 * only accept selected audio formats through their chat adapters.
 */
export const createAudioSubmissionFile = async (blob: Blob): Promise<AudioSubmissionFile> => {
	if (blob.size === 0) {
		throw new Error("Die Audioaufnahme enthält keine Audiodaten.");
	}

	const mimeType = blob.type || "audio/webm";
	const payload: AudioSubmissionFile = {
		data: await blobToBase64(blob),
		mimeType,
	};

	if (isWavMimeType(mimeType)) {
		return payload;
	}

	const wavBlob = await createWavFallback(blob);
	if (!wavBlob) {
		return payload;
	}

	return {
		...payload,
		wavFallback: {
			data: await blobToBase64(wavBlob),
			mimeType: "audio/wav",
		},
	};
};
