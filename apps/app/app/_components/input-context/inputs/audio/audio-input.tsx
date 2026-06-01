"use client";

import { Kbd } from "@repo/design-system/components/ui/kbd";
import { LiveWaveform } from "@repo/design-system/components/ui/live-waveform";
import type { AudioDevice } from "@repo/design-system/components/ui/mic-selector";
import {
	getMicrophoneErrorMessage,
	MicSelector,
} from "@repo/design-system/components/ui/mic-selector";
import { cn } from "@repo/design-system/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { RecordingPlaybackRow } from "./recording-playback-row";
import type { AudioRecording } from "../../types";

interface AudioInputProps {
	className?: string;
	disabled?: boolean;
	maxRecordings?: number;
	onValueChange?: (recordings: AudioRecording[]) => void;
	value: AudioRecording[];
}

const preferredAudioTypes = [
	"audio/mp4",
	"audio/webm;codecs=opus",
	"audio/webm",
	"audio/wav",
];

const getSupportedMimeType = () => {
	if (typeof MediaRecorder === "undefined") {
		return undefined;
	}

	return preferredAudioTypes.find((type) => MediaRecorder.isTypeSupported(type));
};

const cleanDeviceLabel = (label: string | undefined) =>
	(label || "Mikrofon").replaceAll(/\s*\([^)]*\)/g, "").trim() || "Mikrofon";

export const AudioInput = ({
	className,
	disabled = false,
	maxRecordings = 3,
	onValueChange,
	value: recordings,
}: AudioInputProps) => {
	const [isRecording, setIsRecording] = useState(false);
	const [isMicMuted, setIsMicMuted] = useState(false);
	const [selectedDeviceId, setSelectedDeviceId] = useState("");
	const [selectedDeviceLabel, setSelectedDeviceLabel] = useState("Mikrofon");
	const audioChunksRef = useRef<Blob[]>([]);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const recordingStartTimeRef = useRef(0);
	const recordingsRef = useRef(recordings);

	const canRecord = recordings.length < maxRecordings;

	useEffect(() => {
		recordingsRef.current = recordings;
	}, [recordings]);

	useEffect(
		() => () => {
			for (const recording of recordingsRef.current) {
				URL.revokeObjectURL(recording.url);
			}
		},
		[],
	);

	const handleStreamReady = useCallback(
		(stream: MediaStream) => {
			const mimeType = getSupportedMimeType();
			const mediaRecorder = new MediaRecorder(
				stream,
				mimeType ? { mimeType } : undefined,
			);

			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			recordingStartTimeRef.current = Date.now();

			mediaRecorder.addEventListener("dataavailable", (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			});

			mediaRecorder.addEventListener("stop", () => {
				const recordingMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
				const blob = new Blob(audioChunksRef.current, { type: recordingMimeType });
				const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
				const recording: AudioRecording = {
					blob,
					duration,
					id: `audio-${Date.now()}`,
					mimeType: recordingMimeType,
					sourceDeviceLabel: cleanDeviceLabel(
						selectedDeviceLabel || stream.getAudioTracks()[0]?.label,
					),
					url: URL.createObjectURL(blob),
				};

				onValueChange?.([...recordings, recording]);
				mediaRecorderRef.current = null;
			});

			mediaRecorder.start();
			toast.success("Aufnahme gestartet");
		},
		[onValueChange, recordings, selectedDeviceLabel],
	);

	const handleDeviceChange = useCallback((device: AudioDevice | null) => {
		if (!device) {
			setSelectedDeviceLabel("Mikrofon");
			return;
		}

		setSelectedDeviceLabel(cleanDeviceLabel(device.label));
	}, []);

	const handleWaveformError = useCallback((error: Error) => {
		console.error("Error starting recording:", error);
		setIsRecording(false);
		toast.error(getMicrophoneErrorMessage(error));
	}, []);

	const handleStartRecording = useCallback(() => {
		if (!canRecord) {
			toast.error(`Maximal ${maxRecordings} Aufnahmen möglich`);
			return;
		}

		if (isMicMuted) {
			toast.error("Mikrofon ist stummgeschaltet");
			return;
		}

		setIsRecording(true);
	}, [canRecord, isMicMuted, maxRecordings]);

	const handleStopRecording = useCallback(() => {
		if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
			setIsRecording(false);
			return;
		}

		try {
			mediaRecorderRef.current.stop();
			toast.success("Aufnahme beendet");
		} catch (error) {
			console.error("Error stopping recording:", error);
			toast.error("Fehler beim Stoppen der Aufnahme");
		} finally {
			setIsRecording(false);
		}
	}, []);

	const handleToggleRecording = useCallback(() => {
		if (isRecording) {
			handleStopRecording();
			return;
		}

		handleStartRecording();
	}, [handleStartRecording, handleStopRecording, isRecording]);

	const handleRemoveRecording = useCallback(
		(id: string) => {
			const removed = recordings.find((recording) => recording.id === id);
			if (removed) {
				URL.revokeObjectURL(removed.url);
			}
			onValueChange?.(recordings.filter((recording) => recording.id !== id));
		},
		[onValueChange, recordings],
	);

	const canAttemptRecordingToggle = isRecording || (!disabled && canRecord);
	const recordingButtonTitle = isRecording
		? "Aufnahme stoppen"
		: canRecord
			? "Audioaufnahme starten"
			: `Maximal ${maxRecordings} Aufnahmen möglich`;
	const recordingToggleLabel = isRecording
		? "Aufnahme stoppen"
		: canRecord
			? "Aufnahme starten"
			: "Maximale Aufnahmen erreicht";
	const showRecorderWaveform = isRecording && !isMicMuted;

	useHotkeys(
		["meta+shift+m", "ctrl+shift+m"],
		(event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			handleToggleRecording();
		},
		{
			enableOnFormTags: ["INPUT", "TEXTAREA"],
			enabled: canAttemptRecordingToggle,
		},
		[canAttemptRecordingToggle, handleToggleRecording],
	);

	return (
		<div className={cn("space-y-4", className)}>
			<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-2">
				<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
					<div className="h-9 w-full min-w-0 sm:flex-1">
						<button
							aria-label={recordingButtonTitle}
							aria-keyshortcuts="Meta+Shift+M Control+Shift+M"
							aria-pressed={isRecording}
							className={cn(
								"group relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/5 py-1 text-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solarized-blue focus-visible:ring-offset-2 focus-visible:ring-offset-solarized-base3",
								canAttemptRecordingToggle
									? "cursor-pointer hover:bg-foreground/10"
									: "cursor-not-allowed opacity-70",
							)}
							disabled={!canAttemptRecordingToggle}
							onClick={handleToggleRecording}
							title={recordingButtonTitle}
							type="button"
						>
							<LiveWaveform
								active={showRecorderWaveform}
								barGap={1}
								barRadius={4}
								barWidth={3}
								className={cn(
									"h-full w-full text-foreground transition-opacity duration-300",
									showRecorderWaveform ? "opacity-100" : "opacity-0",
								)}
								deviceId={selectedDeviceId || undefined}
								fadeEdges
								fadeWidth={24}
								height={20}
								historySize={140}
								mode="scrolling"
								onError={handleWaveformError}
								onStreamEnd={() => {
									mediaRecorderRef.current = null;
								}}
								onStreamReady={handleStreamReady}
								processing={disabled}
								sensitivity={5}
								smoothingTimeConstant={0.85}
							/>
							<div
								className={cn(
									"absolute inset-0 flex items-center justify-center transition-opacity",
									showRecorderWaveform
										? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
										: "opacity-100",
								)}
							>
								<span className="flex items-center gap-2 rounded-sm px-1.5 font-medium text-foreground/50 text-xs">
									{recordingToggleLabel}
									{canAttemptRecordingToggle ? (
										<Kbd className="h-5 min-w-fit bg-background/80 px-1.5 text-[10px] text-foreground/60">
											⌘⇧M
										</Kbd>
									) : null}
								</span>
							</div>
						</button>
					</div>
					<div className="flex w-full flex-wrap items-center justify-center gap-1 sm:w-auto sm:flex-nowrap sm:justify-end">
						<MicSelector
							className="w-full justify-start border border-solarized-blue/30 bg-solarized-blue/5 text-solarized-base00 hover:border-solarized-blue hover:bg-solarized-blue/10 hover:text-solarized-blue sm:w-56"
							disabled={disabled || isRecording}
							muted={isMicMuted}
							onDeviceChange={handleDeviceChange}
							onMutedChange={setIsMicMuted}
							onValueChange={setSelectedDeviceId}
							requestPermissionOnMount
							value={selectedDeviceId}
						/>
					</div>
				</div>
			</div>

			{recordings.length > 0 ? (
				<div className="space-y-3">
					{recordings.map((recording, index) => (
						<RecordingPlaybackRow
							blob={recording.blob}
							disabled={disabled}
							duration={recording.duration}
							isRecording={isRecording}
							key={recording.id}
							onRemove={() => {
								handleRemoveRecording(recording.id);
							}}
							sourceDeviceLabel={recording.sourceDeviceLabel}
							title={`Aufnahme ${index + 1}`}
							waveformSeed={`${recording.id}-${recording.duration}-${recording.sourceDeviceLabel}`}
						/>
					))}
				</div>
			) : null}
			<p className="text-solarized-base01 text-xs">
				{recordings.length}/{maxRecordings} Aufnahmen
			</p>
		</div>
	);
};
