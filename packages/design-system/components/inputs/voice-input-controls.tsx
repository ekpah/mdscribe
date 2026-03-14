"use client";

import { Mic, Square, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";

export interface VoiceFillAudioFile {
	data: string;
	mimeType: string;
}

interface AudioRecording {
	blob: Blob;
	duration: number;
	id: string;
}

interface VoiceInputControlsProps {
	className?: string;
	maxRecordings?: number;
	onSubmit: (audioFiles: VoiceFillAudioFile[]) => Promise<void>;
	pendingLabel?: string;
	submitLabel?: string;
	title?: string;
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

const blobToBase64 = async (blob: Blob): Promise<string> => {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	return encodeUint8ArrayToBase64(bytes);
};

const formatDuration = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const VoiceInputControls = ({
	className,
	maxRecordings = 3,
	onSubmit,
	pendingLabel = "...",
	submitLabel = "Füllen",
	title = "Sprache",
}: VoiceInputControlsProps) => {
	const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
	const [isRecording, setIsRecording] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingStartTimeRef = useRef<number>(0);

	const canRecord = audioRecordings.length < maxRecordings;

	const handleStartRecording = useCallback(async () => {
		if (!canRecord) {
			toast.error(`Maximal ${maxRecordings} Aufnahmen möglich`);
			return;
		}

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
				setAudioRecordings((prev) => [
					...prev,
					{
						blob: audioBlob,
						duration,
						id: `audio-${Date.now()}`,
					},
				]);

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
	}, [canRecord, maxRecordings]);

	const handleStopRecording = useCallback(() => {
		if (!mediaRecorderRef.current || !isRecording) {
			return;
		}

		mediaRecorderRef.current.stop();
		setIsRecording(false);
		toast.success("Aufnahme beendet");
	}, [isRecording]);

	const handleToggleRecording = useCallback(async () => {
		if (isRecording) {
			handleStopRecording();
			return;
		}

		try {
			await handleStartRecording();
		} catch (error) {
			console.error("Error starting recording:", error);
		}
	}, [handleStartRecording, handleStopRecording, isRecording]);

	const handleRemoveRecording = useCallback((id: string) => {
		setAudioRecordings((prev) =>
			prev.filter((recording) => recording.id !== id),
		);
	}, []);

	const handleRemoveRecordingById = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const recording of audioRecordings) {
			handlers[recording.id] = () => {
				handleRemoveRecording(recording.id);
			};
		}
		return handlers;
	}, [audioRecordings, handleRemoveRecording]);

	const handleSubmit = useCallback(async () => {
		if (audioRecordings.length === 0) {
			toast.error("Bitte zuerst Audio aufnehmen");
			return;
		}

		setIsSubmitting(true);

		try {
			const audioFiles = await Promise.all(
				audioRecordings.map(async (recording) => ({
					data: await blobToBase64(recording.blob),
					mimeType: recording.blob.type,
				})),
			);

			await onSubmit(audioFiles);
			setAudioRecordings([]);
		} catch {
			// Preserve recordings so the user can retry after a failed submission.
		} finally {
			setIsSubmitting(false);
		}
	}, [audioRecordings, onSubmit]);

	const recordingButtonTitle = (() => {
		if (!canRecord && !isRecording) {
			return `Maximal ${maxRecordings} Aufnahmen möglich`;
		}
		if (isRecording) {
			return "Aufnahme stoppen";
		}
		return "Audioaufnahme starten";
	})();

	return (
		<div className={cn("space-y-3", className)}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-muted-foreground text-xs">
					<Mic className="h-3.5 w-3.5" />
					<span>{title}</span>
				</div>
				<Button
					aria-label={
						isRecording ? "Aufnahme stoppen" : "Audioaufnahme starten"
					}
					className={isRecording ? "bg-solarized-red text-white" : ""}
					disabled={!(canRecord || isRecording)}
					onClick={handleToggleRecording}
					size="icon"
					title={recordingButtonTitle}
					type="button"
					variant={isRecording ? "default" : "outline"}
				>
					{isRecording ? (
						<Square className="h-4 w-4" />
					) : (
						<Mic className="h-4 w-4" />
					)}
				</Button>
			</div>

				{audioRecordings.length > 0 ? (
					<div className="space-y-1">
						{audioRecordings.map((recording, index) => (
							<div
								className="flex items-center justify-between rounded-md border border-solarized-green/30 bg-solarized-green/10 px-2 py-1"
								key={recording.id}
							>
								<div className="flex items-center gap-2 text-solarized-green text-xs">
									<Mic className="h-3.5 w-3.5" />
									<span>
										#{index + 1} · {formatDuration(recording.duration)}
									</span>
								</div>
								<Button
									aria-label="Aufnahme entfernen"
									onClick={handleRemoveRecordingById[recording.id]}
									size="icon"
									type="button"
									variant="ghost"
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>
				) : null}

			<Button
				className="w-full"
				disabled={audioRecordings.length === 0 || isSubmitting}
				onClick={handleSubmit}
				type="button"
				variant="default"
			>
				{isSubmitting ? (
					pendingLabel
				) : (
					<>
						<Mic className="mr-2 h-4 w-4" />
						{submitLabel}
					</>
				)}
			</Button>
		</div>
	);
};
