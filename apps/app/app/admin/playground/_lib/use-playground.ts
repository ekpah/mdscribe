"use client";

import { useCompletion } from "@ai-sdk/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type {
	AudioFile,
	DocumentFile,
	ImageFile,
	PlaygroundMessage,
	PlaygroundModel,
	PlaygroundParameters,
	PlaygroundResult,
} from "./types";
import { DEFAULT_PARAMETERS } from "./types";

export interface UsePlaygroundOptions {
	initialModel?: PlaygroundModel | null;
	initialParameters?: PlaygroundParameters;
	initialSystemPrompt?: string;
	initialUserPrompt?: string;
}

export function usePlayground(options: UsePlaygroundOptions = {}) {
	const {
		initialModel = null,
		initialParameters = DEFAULT_PARAMETERS,
		initialSystemPrompt = "",
		initialUserPrompt = "",
	} = options;

	// State
	const [model, setModel] = useState<PlaygroundModel | null>(initialModel);
	const [parameters, setParameters] =
		useState<PlaygroundParameters>(initialParameters);
	const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
	const [userPrompt, setUserPrompt] = useState(initialUserPrompt);
	const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
	const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
	const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([]);
	const [result, setResult] = useState<PlaygroundResult | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);

	// Recording state
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingStartTimeRef = useRef<number>(0);

	// Timing
	const startTimeRef = useRef<number>(0);

	// AI SDK completion hook
	const completion = useCompletion({
		api: "/api/admin/playground/run",
		onError: (error) => {
			setResult((prev) =>
				prev
					? { ...prev, error: error.message, isStreaming: false }
					: {
							text: "",
							metrics: { latencyMs: Date.now() - startTimeRef.current },
							isStreaming: false,
							error: error.message,
						},
			);
			setIsGenerating(false);
			toast.error(error.message || "Fehler beim Generieren");
		},
		onFinish: () => {
			const latencyMs = Date.now() - startTimeRef.current;
			setResult((prev) =>
				prev ? { ...prev, isStreaming: false, metrics: { ...prev.metrics, latencyMs } } : null,
			);
			setIsGenerating(false);
		},
	});

	// Update result when completion changes
	const updateResult = useCallback(() => {
		if (completion.completion) {
			setResult((prev) => ({
				text: completion.completion,
				reasoning: prev?.reasoning,
				metrics: prev?.metrics || { latencyMs: 0 },
				isStreaming: completion.isLoading,
				error: prev?.error,
			}));
		}
	}, [completion.completion, completion.isLoading]);

	// Convert file to base64
	const fileToBase64 = async (blob: Blob): Promise<string> => {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const base64String = (reader.result as string).split(",")[1];
				resolve(base64String);
			};
			reader.readAsDataURL(blob);
		});
	};

	// Generate function
	const generate = useCallback(async () => {
		if (!model) {
			toast.error("Bitte wählen Sie ein Modell aus");
			return;
		}

		if (!userPrompt.trim() && audioFiles.length === 0 && imageFiles.length === 0 && documentFiles.length === 0) {
			toast.error("Bitte geben Sie einen Prompt ein oder fügen Sie Dateien hinzu");
			return;
		}

		setIsGenerating(true);
		startTimeRef.current = Date.now();
		setResult({
			text: "",
			metrics: { latencyMs: 0 },
			isStreaming: true,
		});
		completion.setCompletion("");

		try {
			// Build messages
			const messages: PlaygroundMessage[] = [];
			if (systemPrompt.trim()) {
				messages.push({ role: "system", content: systemPrompt });
			}
			messages.push({ role: "user", content: userPrompt });

			// Convert files to base64
			const audioFilesBase64 = await Promise.all(
				audioFiles.map(async (f) => ({
					data: await fileToBase64(f.blob),
					mimeType: f.mimeType,
				})),
			);

			const imageFilesBase64 = await Promise.all(
				imageFiles.map(async (f) => ({
					data: await fileToBase64(f.blob),
					mimeType: f.mimeType,
				})),
			);

			const documentFilesBase64 = await Promise.all(
				documentFiles.map(async (f) => ({
					data: await fileToBase64(f.blob),
					mimeType: f.mimeType,
					filename: f.filename,
				})),
			);

			// Make request
			await completion.complete(userPrompt, {
				body: {
					model: model.id,
					messages,
					parameters: {
						temperature: parameters.temperature,
						maxTokens: parameters.maxTokens,
						thinking: parameters.thinking,
						thinkingBudget: parameters.thinkingBudget,
						topP: parameters.topP,
						topK: parameters.topK,
						frequencyPenalty: parameters.frequencyPenalty,
						presencePenalty: parameters.presencePenalty,
					},
					audioFiles: audioFilesBase64.length > 0 ? audioFilesBase64 : undefined,
					imageFiles: imageFilesBase64.length > 0 ? imageFilesBase64 : undefined,
					documentFiles: documentFilesBase64.length > 0 ? documentFilesBase64 : undefined,
				},
			});
		} catch (error) {
			setIsGenerating(false);
			toast.error(error instanceof Error ? error.message : "Fehler beim Generieren");
		}
	}, [
		model,
		userPrompt,
		systemPrompt,
		parameters,
		audioFiles,
		imageFiles,
		documentFiles,
		completion,
	]);

	// Stop generation
	const stop = useCallback(() => {
		completion.stop();
		setIsGenerating(false);
		setResult((prev) => (prev ? { ...prev, isStreaming: false } : null));
	}, [completion]);

	// Reset
	const reset = useCallback(() => {
		setUserPrompt("");
		setResult(null);
		completion.setCompletion("");
		setAudioFiles([]);
		setImageFiles([]);
		setDocumentFiles([]);
	}, [completion]);

	// Audio recording
	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			recordingStartTimeRef.current = Date.now();

			mediaRecorder.addEventListener("dataavailable", (event) => {
				audioChunksRef.current.push(event.data);
			});

			mediaRecorder.addEventListener("stop", () => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: "audio/wav",
				});
				const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
				const newRecording: AudioFile = {
					id: `audio-${Date.now()}`,
					blob: audioBlob,
					duration,
					mimeType: "audio/wav",
				};
				setAudioFiles((prev) => [...prev, newRecording]);
				for (const track of stream.getTracks()) {
					track.stop();
				}
			});

			mediaRecorder.start();
			setIsRecording(true);
			toast.success("Aufnahme gestartet");
		} catch (error) {
			console.error("Error starting recording:", error);
			toast.error("Fehler beim Starten der Aufnahme");
		}
	}, []);

	const stopRecording = useCallback(() => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
			toast.success("Aufnahme beendet");
		}
	}, [isRecording]);

	const removeAudioFile = useCallback((id: string) => {
		setAudioFiles((prev) => prev.filter((f) => f.id !== id));
	}, []);

	// Image handling
	const addImageFiles = useCallback((files: FileList | File[]) => {
		const filesArray = Array.from(files);
		const newImages: ImageFile[] = filesArray
			.filter((f) => f.type.startsWith("image/"))
			.map((f) => ({
				id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				blob: f,
				url: URL.createObjectURL(f),
				mimeType: f.type,
				filename: f.name,
			}));
		setImageFiles((prev) => [...prev, ...newImages]);
	}, []);

	const removeImageFile = useCallback((id: string) => {
		setImageFiles((prev) => {
			const file = prev.find((f) => f.id === id);
			if (file?.url) {
				URL.revokeObjectURL(file.url);
			}
			return prev.filter((f) => f.id !== id);
		});
	}, []);

	// Document handling
	const addDocumentFiles = useCallback((files: FileList | File[]) => {
		const filesArray = Array.from(files);
		const newDocs: DocumentFile[] = filesArray
			.filter(
				(f) =>
					f.type === "application/pdf" ||
					f.type.includes("document") ||
					f.type === "text/plain",
			)
			.map((f) => ({
				id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				blob: f,
				url: URL.createObjectURL(f),
				mimeType: f.type,
				filename: f.name,
			}));
		setDocumentFiles((prev) => [...prev, ...newDocs]);
	}, []);

	const removeDocumentFile = useCallback((id: string) => {
		setDocumentFiles((prev) => {
			const file = prev.find((f) => f.id === id);
			if (file?.url) {
				URL.revokeObjectURL(file.url);
			}
			return prev.filter((f) => f.id !== id);
		});
	}, []);

	return {
		// State
		model,
		setModel,
		parameters,
		setParameters,
		systemPrompt,
		setSystemPrompt,
		userPrompt,
		setUserPrompt,
		audioFiles,
		imageFiles,
		documentFiles,
		result,
		isGenerating,
		isRecording,
		completion: completion.completion,

		// Actions
		generate,
		stop,
		reset,
		startRecording,
		stopRecording,
		removeAudioFile,
		addImageFiles,
		removeImageFile,
		addDocumentFiles,
		removeDocumentFile,
		updateResult,
	};
}
