"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDown, FileText, Mic, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
} from "@/lib/input-fill-limits";
import { AudioInput } from "./inputs/audio/audio-input";
import { DocumentInput } from "./inputs/document/document-input";
import { TextInput } from "./inputs/text/text-input";
import type {
	InputContextController,
	InputContextPanel,
	InputContextSubmission,
} from "./types";

export { useInputContextState } from "./use-input-context-state";

type InputContextControlsVariant = "overlay" | "tabs";

interface InputContextControlsProps {
	className?: string;
	controller: InputContextController;
	defaultPanel?: InputContextPanel | null;
	disabled?: boolean;
	onSubmit?: (payload: InputContextSubmission) => Promise<void>;
	panelPortalTarget?: HTMLElement | null;
	pendingLabel?: string;
	showSubmit?: boolean;
	submitLabel?: string;
	textPanelContent?: ReactNode;
	textPanelDescription?: string;
	textPanelHasValue?: boolean;
	textPanelTitle?: string;
	title?: string;
	trailingAction?: ReactNode;
	variant?: InputContextControlsVariant;
}

export const InputContextControls = ({
	className,
	controller,
	defaultPanel = null,
	disabled = false,
	onSubmit,
	panelPortalTarget,
	pendingLabel = "Wird ausgefüllt...",
	showSubmit = true,
	submitLabel = "Füllen",
	textPanelContent,
	textPanelDescription = `Hier kannst du Text aus dem aktuellen Fall einfügen. Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters.toLocaleString("de-DE")} Zeichen.`,
	textPanelHasValue,
	textPanelTitle = "Textkontext",
	title,
	trailingAction,
	variant = "overlay",
}: InputContextControlsProps) => {
	const [openPanel, setOpenPanel] = useState<InputContextPanel | null>(
		defaultPanel,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const isTabVariant = variant === "tabs";
	const isPanelDisabled = disabled || isSubmitting;

	const handlePanelToggle = useCallback(
		(panel: InputContextPanel) => {
			setOpenPanel((prev) => {
				if (isTabVariant) {
					return panel;
				}
				return prev === panel ? null : panel;
			});
		},
		[isTabVariant],
	);

	const handlePanelClose = useCallback(() => {
		setOpenPanel(null);
	}, []);

	const handleSubmit = useCallback(async () => {
		if (!onSubmit) {
			return;
		}

		if (!controller.hasAnyContext) {
			toast.error("Bitte zuerst Audio aufnehmen, Text eingeben oder Dateien hinzufügen");
			return;
		}

		setIsSubmitting(true);

		try {
			await onSubmit(await controller.prepareSubmission());
		} catch (error) {
			if (error instanceof Error && error.message) {
				toast.error(error.message);
			}
			// Keep captured context visible so the user can inspect or retry.
		} finally {
			setIsSubmitting(false);
		}
	}, [controller, onSubmit]);

	const handleTextSubmitShortcut = useCallback(
		() => {
			if (controller.hasAnyContext && !isSubmitting) {
				void handleSubmit();
			}
		},
		[controller.hasAnyContext, handleSubmit, isSubmitting],
	);

	const handleTextContextLimitExceeded = useCallback((maxCharacters: number) => {
		toast.error(
			`Textkontext ist zu lang. Maximal ${maxCharacters.toLocaleString("de-DE")} Zeichen möglich.`,
		);
	}, []);

	const renderPanelShell = (
		panelTitle: string,
		panelDescription: string,
		children: ReactNode,
	) => (
		<div
			className={cn(
				"z-20 bg-solarized-blue/10 p-4 shadow-lg backdrop-blur",
				isTabVariant
					? "static min-h-[min(68svh,36rem)] rounded-t-lg shadow-none"
					: panelPortalTarget
						? "absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-none"
						: "static mb-3 max-h-[min(60svh,32rem)] overflow-y-auto overscroll-contain rounded-lg lg:absolute lg:right-4 lg:bottom-full lg:left-4 lg:mb-2 lg:max-h-96",
			)}
		>
			<div className="mb-4 flex items-center justify-between gap-2">
				<div className="min-w-0">
					<div className="font-medium text-foreground text-sm">{panelTitle}</div>
					<div className="text-muted-foreground text-xs">{panelDescription}</div>
				</div>
				{isTabVariant ? null : (
					<Button
						aria-label={`${panelTitle} minimieren`}
						onClick={handlePanelClose}
						size="icon"
						type="button"
						variant="ghost"
					>
						<ChevronDown className="h-4 w-4" />
					</Button>
				)}
			</div>
			{children}
		</div>
	);

	const textPanel = renderPanelShell(
		textPanelTitle,
		textPanelDescription,
		textPanelContent ?? (
			<TextInput
				disabled={isPanelDisabled}
				maxCharacters={FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters}
				onMaxCharactersExceeded={handleTextContextLimitExceeded}
				onSubmitShortcut={handleTextSubmitShortcut}
				onValueChange={controller.setTextContext}
				stretchFields={Boolean(panelPortalTarget)}
				value={controller.textContext}
			/>
		),
	);

	const audioPanel = renderPanelShell(
		"Audio",
		`Nimm bis zu ${FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles} Aufnahmen auf. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
		<AudioInput
			disabled={isPanelDisabled}
			maxRecordings={controller.effectiveMaxRecordings}
			onValueChange={controller.setAudioRecordings}
			value={controller.audioRecordings}
		/>,
	);

	const filePanel = renderPanelShell(
		"Dateien",
		"Füge Dateien als Kontext hinzu und entferne sie wieder, bevor du die Anfrage sendest.",
		<DocumentInput
			disabled={isPanelDisabled}
			onValueChange={controller.setContextFiles}
			value={controller.contextFiles}
		/>,
	);

	const activePanel =
		openPanel === "text"
			? textPanel
			: openPanel === "audio"
				? audioPanel
				: openPanel === "files"
					? filePanel
					: null;
	const hasVisibleText = textPanelHasValue ?? controller.hasTextContext;

	return (
		<div
			className={cn("relative w-full space-y-2", className)}
			data-align={isTabVariant ? "block-start" : undefined}
		>
			{activePanel
				? panelPortalTarget && !isTabVariant
					? createPortal(activePanel, panelPortalTarget)
					: activePanel
				: null}

			<div
				className={cn(
					"flex min-w-0 items-center gap-2",
					isTabVariant &&
						"rounded-b-lg border border-solarized-blue/20 bg-solarized-blue/5 px-3 py-2",
				)}
			>
				{title ? (
					<div className="min-w-0 flex-1">
						<span className="truncate font-medium text-foreground text-xs">
							{title}
						</span>
					</div>
				) : null}
				<Button
					aria-expanded={openPanel === "files"}
					aria-label="Dateien hinzufügen"
					className="relative shrink-0"
					onClick={() => {
						handlePanelToggle("files");
					}}
					size="icon"
					title="Dateien hinzufügen"
					type="button"
					variant={
						openPanel === "files" || controller.hasContextFiles
							? "secondary"
							: "outline"
					}
				>
					<Paperclip className="h-4 w-4" />
					{controller.hasContextFiles ? (
						<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-solarized-green" />
					) : null}
				</Button>
				<Button
					aria-expanded={openPanel === "audio"}
					aria-label="Audio-Kontext öffnen"
					className="relative shrink-0"
					onClick={() => {
						handlePanelToggle("audio");
					}}
					size="icon"
					title="Audio-Kontext öffnen"
					type="button"
					variant={
						openPanel === "audio" || controller.hasAudioRecordings
							? "secondary"
							: "outline"
					}
				>
					<Mic className="h-4 w-4" />
					{controller.hasAudioRecordings ? (
						<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-solarized-green" />
					) : null}
				</Button>
				<Button
					aria-expanded={openPanel === "text"}
					aria-label="Textkontext öffnen"
					className="relative shrink-0"
					onClick={() => {
						handlePanelToggle("text");
					}}
					size="icon"
					type="button"
					variant={
						openPanel === "text" || hasVisibleText ? "secondary" : "outline"
					}
				>
					<FileText className="h-4 w-4" />
					{hasVisibleText ? (
						<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-solarized-green" />
					) : null}
				</Button>
				{trailingAction ? (
					<div className="ml-auto flex shrink-0 items-center">{trailingAction}</div>
				) : null}
				{showSubmit && onSubmit ? (
					<Button
						className={cn("h-9 shrink-0 px-3 text-xs", !trailingAction && "ml-auto")}
						disabled={!controller.hasAnyContext || isSubmitting}
						onClick={handleSubmit}
						type="button"
						variant="default"
					>
						{isSubmitting ? pendingLabel : submitLabel}
					</Button>
				) : null}
			</div>
		</div>
	);
};
