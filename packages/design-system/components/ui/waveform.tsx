"use client";

import {
	type HTMLAttributes,
	type KeyboardEvent,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { cn } from "@repo/design-system/lib/utils";

const resolveCanvasColor = (
	canvas: HTMLCanvasElement,
	customColor: string | undefined,
	fallbackProperty = "--foreground",
) => {
	const styles = getComputedStyle(canvas);
	const resolveValue = (value: string, depth = 0): string => {
		if (depth > 4) {
			return styles.color || "#000";
		}

		const trimmedValue = value.trim();
		const variableMatch = /^var\((--[^),]+)(?:,[^)]+)?\)$/.exec(trimmedValue);
		if (!variableMatch) {
			return trimmedValue || styles.color || "#000";
		}

		const resolvedValue = styles.getPropertyValue(variableMatch[1]).trim();
		return resolvedValue
			? resolveValue(resolvedValue, depth + 1)
			: styles.color || "#000";
	};

	return resolveValue(
		customColor || styles.getPropertyValue(fallbackProperty) || styles.color,
	);
};

type WaveformProps = HTMLAttributes<HTMLDivElement> & {
	barColor?: string;
	barGap?: number;
	barHeight?: number;
	barRadius?: number;
	barWidth?: number;
	data?: number[];
	fadeEdges?: boolean;
	fadeWidth?: number;
	height?: number | string;
};

const createIdleWaveformData = (bars = 100) =>
	Array.from({ length: bars }, (_, index) => {
		const wave = Math.sin(index * 0.53) * 0.18 + Math.cos(index * 0.19) * 0.1;
		return Math.max(0.12, Math.min(0.72, 0.34 + wave));
	});

const clampProgress = (value: number) =>
	Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : 0;

const clampTime = (time: number, duration: number) => {
	if (!Number.isFinite(time)) {
		return 0;
	}

	if (!(Number.isFinite(duration) && duration > 0)) {
		return Math.max(0, time);
	}

	return Math.max(0, Math.min(time, duration));
};

const Waveform = ({
	barColor,
	barGap = 2,
	barHeight: baseBarHeight = 4,
	barRadius = 2,
	barWidth = 4,
	className,
	data = [],
	fadeEdges = true,
	fadeWidth = 24,
	height = 128,
	...props
}: WaveformProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const heightStyle = typeof height === "number" ? `${height}px` : height;

	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!(canvas && container)) {
			return;
		}

		const renderWaveform = () => {
			const context = canvas.getContext("2d");
			if (!context) {
				return;
			}

			const rect = canvas.getBoundingClientRect();
			context.clearRect(0, 0, rect.width, rect.height);

			const computedBarColor = resolveCanvasColor(canvas, barColor);
			const step = barWidth + barGap;
			const barCount = Math.floor(rect.width / step);
			const centerY = rect.height / 2;

			for (let index = 0; index < barCount; index += 1) {
				const dataIndex = Math.floor((index / barCount) * data.length);
				const value = data[dataIndex] ?? 0;
				const renderedBarHeight = Math.max(
					baseBarHeight,
					value * rect.height * 0.8,
				);
				const x = index * step;
				const y = centerY - renderedBarHeight / 2;

				context.fillStyle = computedBarColor;
				context.globalAlpha = 0.3 + value * 0.7;

				if (barRadius > 0) {
					context.beginPath();
					context.roundRect(x, y, barWidth, renderedBarHeight, barRadius);
					context.fill();
				} else {
					context.fillRect(x, y, barWidth, renderedBarHeight);
				}
			}

			if (fadeEdges && fadeWidth > 0 && rect.width > 0) {
				const gradient = context.createLinearGradient(0, 0, rect.width, 0);
				const fadePercent = Math.min(0.2, fadeWidth / rect.width);

				gradient.addColorStop(0, "rgba(255,255,255,1)");
				gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
				gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
				gradient.addColorStop(1, "rgba(255,255,255,1)");

				context.globalCompositeOperation = "destination-out";
				context.fillStyle = gradient;
				context.fillRect(0, 0, rect.width, rect.height);
				context.globalCompositeOperation = "source-over";
			}

			context.globalAlpha = 1;
		};

		const resizeObserver = new ResizeObserver(() => {
			const rect = container.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;

			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			canvas.style.width = `${rect.width}px`;
			canvas.style.height = `${rect.height}px`;

			const context = canvas.getContext("2d");
			if (context) {
				context.setTransform(dpr, 0, 0, dpr, 0, 0);
			}

			renderWaveform();
		});

		resizeObserver.observe(container);
		renderWaveform();

		return () => resizeObserver.disconnect();
	}, [
		barColor,
		barGap,
		barRadius,
		barWidth,
		baseBarHeight,
		data,
		fadeEdges,
		fadeWidth,
	]);

	return (
		<div
			className={cn("relative", className)}
			ref={containerRef}
			style={{ height: heightStyle }}
			{...props}
		>
			<canvas
				aria-hidden="true"
				className="block h-full w-full"
				ref={canvasRef}
			/>
		</div>
	);
};

type AudioScrubberProps = WaveformProps & {
	currentTime?: number;
	duration?: number;
	onSeek?: (time: number) => void;
	showHandle?: boolean;
};

export const AudioScrubber = ({
	barGap = 1,
	barHeight,
	barRadius = 1,
	barColor,
	barWidth = 3,
	className,
	currentTime = 0,
	data = [],
	duration = 100,
	fadeEdges = true,
	fadeWidth = 24,
	height = 128,
	onSeek,
	showHandle = true,
	...props
}: AudioScrubberProps) => {
	const [isDragging, setIsDragging] = useState(false);
	const [localProgress, setLocalProgress] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);
	const safeDuration =
		Number.isFinite(duration) && duration > 0 ? duration : 100;
	const safeCurrentTime = clampTime(currentTime, safeDuration);
	const waveformData = useMemo(
		() => (data.length > 0 ? data : createIdleWaveformData()),
		[data],
	);
	const heightStyle = typeof height === "number" ? `${height}px` : height;

	useEffect(() => {
		if (!isDragging) {
			setLocalProgress(clampProgress(safeCurrentTime / safeDuration));
		}
	}, [isDragging, safeCurrentTime, safeDuration]);

	const seekToProgress = useCallback(
		(progress: number) => {
			const nextProgress = clampProgress(progress);
			const nextTime = clampTime(nextProgress * safeDuration, safeDuration);

			setLocalProgress(nextProgress);
			onSeek?.(nextTime);
		},
		[onSeek, safeDuration],
	);

	const handleScrub = useCallback(
		(clientX: number) => {
			const container = containerRef.current;
			if (!container) {
				return;
			}

			const rect = container.getBoundingClientRect();
			if (!(Number.isFinite(rect.width) && rect.width > 0)) {
				return;
			}

			const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
			seekToProgress(x / rect.width);
		},
		[seekToProgress],
	);

	const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragging(true);
		handleScrub(event.clientX);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step = event.shiftKey ? 10 : 5;
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			seekToProgress((safeCurrentTime - step) / safeDuration);
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			seekToProgress((safeCurrentTime + step) / safeDuration);
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			seekToProgress(0);
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			seekToProgress(1);
		}
	};

	useEffect(() => {
		if (!isDragging) {
			return;
		}

		const handleMouseMove = (event: MouseEvent) => {
			handleScrub(event.clientX);
		};

		const handleMouseUp = () => {
			setIsDragging(false);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleScrub, isDragging]);

	return (
		<div
			aria-label="Audiowellenform durchsuchen"
			aria-valuemax={safeDuration}
			aria-valuemin={0}
			aria-valuenow={safeCurrentTime}
			className={cn("relative cursor-pointer select-none", className)}
			onKeyDown={handleKeyDown}
			onMouseDown={handleMouseDown}
			ref={containerRef}
			role="slider"
			style={{ height: heightStyle }}
			tabIndex={0}
			{...props}
		>
			<Waveform
				barColor={barColor}
				barGap={barGap}
				barHeight={barHeight}
				barRadius={barRadius}
				barWidth={barWidth}
				data={waveformData}
				fadeEdges={fadeEdges}
				fadeWidth={fadeWidth}
				height={height}
			/>

			<div
				className="pointer-events-none absolute inset-y-0 left-0 bg-primary/20"
				style={{ width: `${localProgress * 100}%` }}
			/>
			<div
				className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary"
				style={{ left: `${localProgress * 100}%` }}
			/>

			{showHandle ? (
				<div
					className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-lg"
					style={{ left: `${localProgress * 100}%` }}
				/>
			) : null}
		</div>
	);
};
