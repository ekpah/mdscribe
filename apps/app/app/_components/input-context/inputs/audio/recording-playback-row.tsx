"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { AudioScrubber } from "@repo/design-system/components/ui/waveform";
import { cn } from "@repo/design-system/lib/utils";
import { Check, Pause, Play, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface RecordingPlaybackRowProps {
	blob: Blob;
	disabled?: boolean;
	duration: number;
	isRecording?: boolean;
	onRemove: () => void;
	sourceDeviceLabel: string;
	title: string;
	waveformSeed: string;
}

type WebKitAudioWindow = Window &
	typeof globalThis & {
		webkitAudioContext?: typeof AudioContext;
	};

const formatDuration = (seconds: number): string => {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const createSeededWaveformData = (seedInput: string, bars = 64) => {
	const modulus = 2 ** 32;
	let seed = 0;
	for (const char of seedInput) {
		seed = (seed * 31 + char.charCodeAt(0)) % modulus;
	}

	return Array.from({ length: bars }, () => {
		seed = (seed * 1664525 + 1013904223) % modulus;
		const random = seed / modulus;
		return 0.18 + random * 0.72;
	});
};

const clampTime = (time: number, duration: number) => {
	if (!Number.isFinite(time)) {
		return 0;
	}

	if (!(Number.isFinite(duration) && duration > 0)) {
		return Math.max(0, time);
	}

	return Math.max(0, Math.min(time, duration));
};

const getAudioContextConstructor = () => {
	if (typeof window === "undefined") {
		return null;
	}

	return window.AudioContext ?? (window as WebKitAudioWindow).webkitAudioContext ?? null;
};

export function RecordingPlaybackRow({
	blob,
	disabled = false,
	duration: fallbackDuration,
	isRecording = false,
	onRemove,
	sourceDeviceLabel,
	title,
	waveformSeed,
}: RecordingPlaybackRowProps) {
	const audioContextRef = useRef<AudioContext | null>(null);
	const audioBufferRef = useRef<AudioBuffer | null>(null);
	const sourceRef = useRef<AudioBufferSourceNode | null>(null);
	const sourceEndedHandlerRef = useRef<(() => void) | null>(null);
	const durationRef = useRef(fallbackDuration);
	const playbackOffsetRef = useRef(0);
	const playbackStartedAtRef = useRef(0);
	const progressFrameRef = useRef<number | null>(null);
	const isPlayingRef = useRef(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(fallbackDuration);
	const [isDecoding, setIsDecoding] = useState(true);
	const [hasDecodeError, setHasDecodeError] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
	const waveformData = useMemo(
		() => createSeededWaveformData(waveformSeed),
		[waveformSeed],
	);
	const safeDuration =
		Number.isFinite(duration) && duration > 0 ? duration : fallbackDuration;
	durationRef.current = safeDuration;
	const hasEnded =
		safeDuration > 0 &&
		Number.isFinite(currentTime) &&
		currentTime >= safeDuration - 0.05;

	const cancelProgressLoop = useCallback(() => {
		if (progressFrameRef.current === null) {
			return;
		}

		window.cancelAnimationFrame(progressFrameRef.current);
		progressFrameRef.current = null;
	}, []);

	const stopSource = useCallback(() => {
		const source = sourceRef.current;
		if (!source) {
			return;
		}

		if (sourceEndedHandlerRef.current) {
			source.removeEventListener("ended", sourceEndedHandlerRef.current);
			sourceEndedHandlerRef.current = null;
		}
		try {
			source.stop();
		} catch {
			// Source nodes can only be stopped once.
		}
		source.disconnect();
		sourceRef.current = null;
	}, []);

	const setStopped = useCallback(
		(nextTime: number) => {
			cancelProgressLoop();
			stopSource();
			isPlayingRef.current = false;
			setIsPlaying(false);
			playbackOffsetRef.current = clampTime(nextTime, durationRef.current);
			setCurrentTime(playbackOffsetRef.current);
		},
		[cancelProgressLoop, stopSource],
	);

	const startProgressLoop = useCallback(() => {
		cancelProgressLoop();

		const tick = () => {
			const context = audioContextRef.current;
			const buffer = audioBufferRef.current;
			if (!(context && buffer && isPlayingRef.current)) {
				progressFrameRef.current = null;
				return;
			}

			const elapsed = context.currentTime - playbackStartedAtRef.current;
			const nextTime = clampTime(
				playbackOffsetRef.current + elapsed,
				buffer.duration,
			);
			setCurrentTime(nextTime);

			if (nextTime >= buffer.duration - 0.02) {
				setStopped(buffer.duration);
				return;
			}

			progressFrameRef.current = window.requestAnimationFrame(tick);
		};

		progressFrameRef.current = window.requestAnimationFrame(tick);
	}, [cancelProgressLoop, setStopped]);

	const startPlaybackAt = useCallback(
		async (offset: number) => {
			const context = audioContextRef.current;
			const buffer = audioBufferRef.current;
			if (!(context && buffer)) {
				return;
			}

			stopSource();
			await context.resume();

			const nextOffset = clampTime(offset, buffer.duration);
			if (nextOffset >= buffer.duration) {
				playbackOffsetRef.current = 0;
				setCurrentTime(0);
			} else {
				playbackOffsetRef.current = nextOffset;
				setCurrentTime(nextOffset);
			}

			const source = context.createBufferSource();
			source.buffer = buffer;
			source.connect(context.destination);
			const handleEnded = () => {
				if (sourceRef.current !== source) {
					return;
				}

				sourceEndedHandlerRef.current = null;
				sourceRef.current = null;
				setStopped(buffer.duration);
			};
			sourceEndedHandlerRef.current = handleEnded;
			source.addEventListener("ended", handleEnded, { once: true });
			sourceRef.current = source;
			playbackStartedAtRef.current = context.currentTime;
			isPlayingRef.current = true;
			setIsPlaying(true);
			source.start(0, playbackOffsetRef.current);
			startProgressLoop();
		},
		[startProgressLoop, setStopped, stopSource],
	);

	useEffect(() => {
		let isCancelled = false;

		const decodeRecording = async () => {
			const AudioContextClass = getAudioContextConstructor();
			if (!AudioContextClass) {
				setHasDecodeError(true);
				setIsDecoding(false);
				return;
			}

			setStopped(0);
			setDuration(fallbackDuration);
			setHasDecodeError(false);
			setIsDecoding(true);

			const context = audioContextRef.current ?? new AudioContextClass();
			audioContextRef.current = context;

			try {
				const arrayBuffer = await blob.arrayBuffer();
				const decodedBuffer = await context.decodeAudioData(arrayBuffer);
				if (isCancelled) {
					return;
				}

				audioBufferRef.current = decodedBuffer;
				durationRef.current = decodedBuffer.duration;
				setDuration(decodedBuffer.duration);
				playbackOffsetRef.current = 0;
				setCurrentTime(0);
			} catch (error) {
				if (isCancelled) {
					return;
				}

				console.error("Error decoding recording:", error);
				audioBufferRef.current = null;
				setHasDecodeError(true);
			} finally {
				if (!isCancelled) {
					setIsDecoding(false);
				}
			}
		};

		void decodeRecording();

		return () => {
			isCancelled = true;
			cancelProgressLoop();
			stopSource();
			isPlayingRef.current = false;
		};
	}, [blob, cancelProgressLoop, fallbackDuration, setStopped, stopSource]);

	useEffect(
		() => () => {
			cancelProgressLoop();
			stopSource();
			void audioContextRef.current?.close();
			audioContextRef.current = null;
		},
		[cancelProgressLoop, stopSource],
	);

	useEffect(() => {
		if (disabled || isRecording) {
			setStopped(currentTime);
		}
	}, [currentTime, disabled, isRecording, setStopped]);

	useEffect(() => {
		if (!isConfirmingDelete) {
			return;
		}

		const timeout = window.setTimeout(() => {
			setIsConfirmingDelete(false);
		}, 3000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [isConfirmingDelete]);

	const handleTogglePlayback = useCallback(async () => {
		if (disabled || isRecording) {
			return;
		}

		if (hasDecodeError) {
			toast.error("Aufnahme konnte nicht vorbereitet werden");
			return;
		}

		if (isDecoding) {
			toast.info("Aufnahme wird noch vorbereitet");
			return;
		}

		if (isPlayingRef.current) {
			const context = audioContextRef.current;
			const buffer = audioBufferRef.current;
			if (context && buffer) {
				const elapsed = context.currentTime - playbackStartedAtRef.current;
				setStopped(playbackOffsetRef.current + elapsed);
			}
			return;
		}

		try {
			await startPlaybackAt(hasEnded ? 0 : currentTime);
		} catch (error) {
			console.error("Error playing recording:", error);
			toast.error("Aufnahme konnte nicht abgespielt werden");
		}
	}, [
		currentTime,
		disabled,
		hasDecodeError,
		hasEnded,
		isDecoding,
		isRecording,
		setStopped,
		startPlaybackAt,
	]);

	const handleSeek = useCallback(
		(time: number) => {
			if (hasDecodeError || isDecoding || !Number.isFinite(time)) {
				return;
			}

			const nextTime = clampTime(time, safeDuration);
			if (!isPlayingRef.current) {
				playbackOffsetRef.current = nextTime;
				setCurrentTime(nextTime);
				return;
			}

			void startPlaybackAt(nextTime);
		},
		[hasDecodeError, isDecoding, safeDuration, startPlaybackAt],
	);

	const handleDeleteClick = useCallback(() => {
		if (!isConfirmingDelete) {
			setIsConfirmingDelete(true);
			return;
		}

		setStopped(0);
		onRemove();
	}, [isConfirmingDelete, onRemove, setStopped]);

	return (
		<div className="flex w-full items-center gap-3 rounded-md border border-solarized-base2 bg-solarized-base3 p-3">
			<Button
				aria-label={isPlaying ? "Aufnahme pausieren" : "Aufnahme abspielen"}
				disabled={disabled || isRecording || isDecoding || hasDecodeError}
				onClick={handleTogglePlayback}
				size="icon"
				title={
					hasDecodeError ? "Aufnahme konnte nicht vorbereitet werden" : undefined
				}
				type="button"
				variant="outline"
			>
				{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
			</Button>
			<div className="hidden h-8 w-28 items-center sm:flex">
				<div className="relative h-6 w-full overflow-hidden rounded-md bg-solarized-blue/5 px-1 text-solarized-base01">
					<AudioScrubber
						barGap={1}
						barRadius={4}
						barWidth={3}
						className={cn(
							"h-full transition-opacity duration-300",
							isDecoding || hasDecodeError
								? "cursor-not-allowed opacity-50"
								: "cursor-pointer",
						)}
						currentTime={currentTime}
						data={waveformData}
						duration={safeDuration}
						height={24}
						onSeek={handleSeek}
					/>
				</div>
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm text-solarized-base00">{title}</p>
				<p className="truncate text-solarized-base01 text-xs">
					{formatDuration(safeDuration)} · {sourceDeviceLabel}
				</p>
			</div>
			<div className="flex w-20 shrink-0 items-center justify-end gap-1">
				{isConfirmingDelete ? (
					<Button
						disabled={disabled || isRecording}
						onClick={() => {
							setIsConfirmingDelete(false);
						}}
						size="icon"
						title="Löschen abbrechen"
						type="button"
						variant="ghost"
					>
						<X className="h-4 w-4" />
					</Button>
				) : null}
				<Button
					className={cn(isConfirmingDelete && "text-solarized-red")}
					disabled={disabled || isRecording}
					onClick={handleDeleteClick}
					size="icon"
					title={isConfirmingDelete ? "Löschen bestätigen" : "Aufnahme löschen"}
					type="button"
					variant="ghost"
				>
					{isConfirmingDelete ? (
						<Check className="h-4 w-4" />
					) : (
						<Trash2 className="h-4 w-4" />
					)}
				</Button>
			</div>
		</div>
	);
}
