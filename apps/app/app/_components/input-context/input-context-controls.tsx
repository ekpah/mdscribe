"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDown, FileText, Mic, Paperclip } from "lucide-react";
import type {
	Dispatch,
	DragEvent,
	ReactNode,
	RefObject,
	SetStateAction,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
} from "@/lib/input-fill-limits";

import { AudioInput } from "./inputs/audio/audio-input";
import type { AudioInputHandle } from "./inputs/audio/audio-input";
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
	onFocusShortcut?: () => void;
	onSubmitShortcut?: () => void | Promise<void>;
	panelPortalTarget?: HTMLElement | null;
	pendingLabel?: string;
	showSubmit?: boolean;
	submitShortcutDisabled?: boolean;
	submitLabel?: string;
	textPanelContent?: ReactNode;
	textPanelDescription?: string;
	textPanelHasValue?: boolean;
	textPanelTitle?: string;
	title?: string;
	trailingAction?: ReactNode;
	variant?: InputContextControlsVariant;
}

const getPanelShellClassName = ({
	hasPortalTarget,
	isTabVariant,
}: {
	hasPortalTarget: boolean;
	isTabVariant: boolean;
}) => {
	let placementClassName =
		"static mb-3 max-h-[min(60svh,32rem)] overflow-y-auto overscroll-contain rounded-lg lg:absolute lg:right-4 lg:bottom-full lg:left-4 lg:mb-2 lg:max-h-96";
	if (isTabVariant) {
		placementClassName =
			"static min-h-[min(68svh,36rem)] rounded-t-lg shadow-none";
	} else if (hasPortalTarget) {
		placementClassName =
			"absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-none";
	}

	return cn(
		"z-20 bg-solarized-blue/10 p-4 shadow-lg backdrop-blur",
		placementClassName,
	);
};

const PanelShell = ({
	children,
	description,
	isTabVariant,
	onClose,
	panel,
	panelPortalTarget,
	title,
}: {
	children: ReactNode;
	description: string;
	isTabVariant: boolean;
	onClose: () => void;
	panel: InputContextPanel;
	panelPortalTarget?: HTMLElement | null;
	title: string;
}) => (
	<div
		className={getPanelShellClassName({
			hasPortalTarget: Boolean(panelPortalTarget),
			isTabVariant,
		})}
		data-input-context-panel={panel}
	>
		<div className="mb-4 flex items-center justify-between gap-2">
			<div className="min-w-0">
				<div className="font-medium text-foreground text-sm">{title}</div>
				<div className="text-muted-foreground text-xs">{description}</div>
			</div>
			{isTabVariant ? null : (
				<Button
					aria-label={`${title} minimieren`}
					onClick={onClose}
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

const ContextToggleButton = ({
	ariaLabel,
	hasValue,
	icon,
	isActive,
	isRecording = false,
	onClick,
	title,
}: {
	ariaLabel: string;
	hasValue: boolean;
	icon: ReactNode;
	isActive: boolean;
	isRecording?: boolean;
	onClick: () => void;
	title?: string;
}) => {
	let indicator: ReactNode = null;
	if (isRecording) {
		indicator = (
			<span className="absolute top-1.5 right-1.5 h-2 w-2 animate-pulse rounded-full bg-solarized-red" />
		);
	} else if (hasValue) {
		indicator = (
			<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-solarized-green" />
		);
	}

	return (
		<Button
			aria-expanded={isActive}
			aria-label={ariaLabel}
			className="relative shrink-0"
			onClick={onClick}
			size="icon"
			title={title}
			type="button"
			variant={isActive || hasValue ? "secondary" : "outline"}
		>
			{icon}
			{indicator}
		</Button>
	);
};

const INPUT_CONTEXT_PANELS: InputContextPanel[] = ["text", "audio", "files"];

const isFileTransfer = (dataTransfer: DataTransfer): boolean =>
	[...dataTransfer.types].includes("Files");

const shouldHandleFileDragEvent = (
	event: DragEvent<HTMLDivElement>,
	disabled: boolean,
): boolean =>
	!event.defaultPrevented && !disabled && isFileTransfer(event.dataTransfer);

const getMountedPanels = (
	panel: InputContextPanel | null,
): Set<InputContextPanel> => (panel ? new Set([panel]) : new Set());

const useInputContextFileDrop = ({
	controller,
	disabled,
	openContextPanel,
	setDragDepth,
}: {
	controller: InputContextController;
	disabled: boolean;
	openContextPanel: (panel: InputContextPanel) => void;
	setDragDepth: Dispatch<SetStateAction<number>>;
}) => {
	const handleRootDragEnter = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!shouldHandleFileDragEvent(event, disabled)) {
				return;
			}

			event.preventDefault();
			setDragDepth((depth) => depth + 1);
		},
		[disabled, setDragDepth],
	);

	const handleRootDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!shouldHandleFileDragEvent(event, disabled)) {
				return;
			}

			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		},
		[disabled],
	);

	const handleRootDragLeave = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!shouldHandleFileDragEvent(event, disabled)) {
				return;
			}

			setDragDepth((depth) => Math.max(0, depth - 1));
		},
		[disabled, setDragDepth],
	);

	const handleRootDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!shouldHandleFileDragEvent(event, disabled)) {
				return;
			}

			event.preventDefault();
			setDragDepth(0);
			const files = [...event.dataTransfer.files];
			if (controller.addContextFiles(files)) {
				openContextPanel("files");
			}
		},
		[controller, disabled, openContextPanel, setDragDepth],
	);

	return {
		handleRootDragEnter,
		handleRootDragLeave,
		handleRootDragOver,
		handleRootDrop,
	};
};

const usePendingRecordingShortcut = ({
	audioInputRef,
	openPanel,
	recordingShortcutRequest,
}: {
	audioInputRef: RefObject<AudioInputHandle | null>;
	openPanel: InputContextPanel | null;
	recordingShortcutRequest: number;
}) => {
	const handledRecordingShortcutRequestRef = useRef(0);

	useEffect(() => {
		if (
			recordingShortcutRequest === 0 ||
			handledRecordingShortcutRequestRef.current === recordingShortcutRequest ||
			openPanel !== "audio"
		) {
			return;
		}

		handledRecordingShortcutRequestRef.current = recordingShortcutRequest;
		audioInputRef.current?.toggleRecording();
	}, [audioInputRef, openPanel, recordingShortcutRequest]);
};

const useInputContextHotkeys = ({
	disabled,
	handleFocusShortcut,
	handleSubmitShortcut,
	hasSubmitShortcut,
	requestRecordingToggle,
}: {
	disabled: boolean;
	handleFocusShortcut: () => void;
	handleSubmitShortcut: () => void;
	hasSubmitShortcut: boolean;
	requestRecordingToggle: () => void;
}) => {
	useHotkeys(
		["meta+shift+1", "ctrl+shift+1"],
		(event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			handleFocusShortcut();
		},
		{
			enableOnFormTags: ["INPUT", "TEXTAREA"],
			enabled: !disabled,
		},
		[disabled, handleFocusShortcut],
	);

	useHotkeys(
		["meta+enter", "ctrl+enter"],
		(event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			handleSubmitShortcut();
		},
		{
			enableOnFormTags: ["INPUT", "TEXTAREA"],
			enabled: !disabled && hasSubmitShortcut,
		},
		[disabled, handleSubmitShortcut, hasSubmitShortcut],
	);

	useHotkeys(
		["meta+shift+2", "ctrl+shift+2"],
		(event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			requestRecordingToggle();
		},
		{
			enableOnFormTags: ["INPUT", "TEXTAREA"],
			enabled: !disabled,
		},
		[disabled, requestRecordingToggle],
	);
};

const ToolbarTitle = ({ title }: { title?: string }) => {
	if (title) {
		return (
			<div className="min-w-0 flex-1">
				<span className="truncate font-medium text-foreground text-xs">
					{title}
				</span>
			</div>
		);
	}

	return null;
};

const SubmitButton = ({
	canShow,
	disabled,
	hasTrailingAction,
	isSubmitting,
	onClick,
	pendingLabel,
	submitLabel,
}: {
	canShow: boolean;
	disabled: boolean;
	hasTrailingAction: boolean;
	isSubmitting: boolean;
	onClick: () => void;
	pendingLabel: string;
	submitLabel: string;
}) => {
	if (!canShow) {
		return null;
	}

	return (
		<Button
			className={cn(
				"h-9 shrink-0 px-3 text-xs",
				hasTrailingAction ? undefined : "ml-auto",
			)}
			disabled={disabled}
			onClick={onClick}
			type="button"
			variant="default"
		>
			{isSubmitting ? pendingLabel : submitLabel}
		</Button>
	);
};

const InputContextDropOverlay = ({ active }: { active: boolean }) => {
	if (!active) {
		return null;
	}

	return (
		<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-solarized-blue border-dashed bg-solarized-blue/15 text-solarized-blue shadow-inner backdrop-blur-sm">
			<div className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 font-medium text-sm shadow-sm">
				<Paperclip className="h-4 w-4" />
				Dateien ablegen
			</div>
		</div>
	);
};

// All mounted panels stay in the tree (hidden when inactive) so panel state
// such as an active audio recording survives switching panels or closing the
// overlay. The portal also carries the drop overlay because file drops on the
// portaled panel bubble through the React tree into the root drop handlers.
const renderInputContextPanels = ({
	isDraggingFiles,
	isTabVariant,
	mountedPanels,
	openPanel,
	panelPortalTarget,
	panels,
}: {
	isDraggingFiles: boolean;
	isTabVariant: boolean;
	mountedPanels: Set<InputContextPanel>;
	openPanel: InputContextPanel | null;
	panelPortalTarget?: HTMLElement | null;
	panels: Record<InputContextPanel, ReactNode>;
}) => {
	const mountedPanelNodes = INPUT_CONTEXT_PANELS.map((panel) =>
		mountedPanels.has(panel) ? (
			<div className={openPanel === panel ? undefined : "hidden"} key={panel}>
				{panels[panel]}
			</div>
		) : null,
	);

	if (panelPortalTarget && !isTabVariant) {
		return createPortal(
			<>
				{mountedPanelNodes}
				<InputContextDropOverlay
					active={isDraggingFiles && openPanel !== null}
				/>
			</>,
			panelPortalTarget,
		);
	}

	return mountedPanelNodes;
};

const InputContextToolbar = ({
	controller,
	handlePanelToggle,
	handleSubmit,
	hasVisibleText,
	isRecordingAudio,
	isSubmitting,
	isTabVariant,
	openPanel,
	pendingLabel,
	showSubmit,
	submitLabel,
	title,
	trailingAction,
}: {
	controller: InputContextController;
	handlePanelToggle: (panel: InputContextPanel) => void;
	handleSubmit: () => void;
	hasVisibleText: boolean;
	isRecordingAudio: boolean;
	isSubmitting: boolean;
	isTabVariant: boolean;
	openPanel: InputContextPanel | null;
	pendingLabel: string;
	showSubmit: boolean;
	submitLabel: string;
	title?: string;
	trailingAction?: ReactNode;
}) => (
	<div
		className={cn(
			"flex min-w-0 items-center gap-2",
			isTabVariant &&
				"rounded-b-lg border border-solarized-blue/20 bg-solarized-blue/5 px-3 py-2",
		)}
	>
		<ToolbarTitle title={title} />
		<ContextToggleButton
			ariaLabel="Dateien hinzufügen"
			hasValue={controller.hasContextFiles}
			icon={<Paperclip className="h-4 w-4" />}
			isActive={openPanel === "files"}
			onClick={() => {
				handlePanelToggle("files");
			}}
			title="Dateien hinzufügen"
		/>
		<ContextToggleButton
			ariaLabel={
				isRecordingAudio ? "Aufnahme läuft – Audio-Kontext öffnen" : "Audio-Kontext öffnen"
			}
			hasValue={controller.hasAudioRecordings}
			icon={
				<Mic
					className={cn("h-4 w-4", isRecordingAudio && "text-solarized-red")}
				/>
			}
			isActive={openPanel === "audio"}
			isRecording={isRecordingAudio}
			onClick={() => {
				handlePanelToggle("audio");
			}}
			title={
				isRecordingAudio ? "Aufnahme läuft – Audio-Kontext öffnen" : "Audio-Kontext öffnen"
			}
		/>
		<ContextToggleButton
			ariaLabel="Textkontext öffnen"
			hasValue={hasVisibleText}
			icon={<FileText className="h-4 w-4" />}
			isActive={openPanel === "text"}
			onClick={() => {
				handlePanelToggle("text");
			}}
		/>
		{trailingAction ? (
			<div className="ml-auto flex shrink-0 items-center">{trailingAction}</div>
		) : null}
		<SubmitButton
			canShow={showSubmit}
			disabled={!controller.hasAnyContext || isSubmitting}
			hasTrailingAction={Boolean(trailingAction)}
			isSubmitting={isSubmitting}
			onClick={handleSubmit}
			pendingLabel={pendingLabel}
			submitLabel={submitLabel}
		/>
	</div>
);

export const InputContextControls = ({
	className,
	controller,
	defaultPanel = null,
	disabled = false,
	onSubmit,
	onFocusShortcut,
	onSubmitShortcut,
	panelPortalTarget,
	pendingLabel = "Wird ausgefüllt...",
	showSubmit = true,
	submitShortcutDisabled = false,
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
	const [mountedPanels, setMountedPanels] = useState<Set<InputContextPanel>>(
		() => getMountedPanels(defaultPanel),
	);
	const [dragDepth, setDragDepth] = useState(0);
	const [recordingShortcutRequest, setRecordingShortcutRequest] = useState(0);
	const [isRecordingAudio, setIsRecordingAudio] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const audioInputRef = useRef<AudioInputHandle>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const isTabVariant = variant === "tabs";
	const isPanelDisabled = disabled || isSubmitting;
	const isDraggingFiles = dragDepth > 0;

	const markPanelMounted = useCallback((panel: InputContextPanel) => {
		setMountedPanels((previousPanels) => {
			if (previousPanels.has(panel)) {
				return previousPanels;
			}
			return new Set([...previousPanels, panel]);
		});
	}, []);

	const openContextPanel = useCallback(
		(panel: InputContextPanel) => {
			markPanelMounted(panel);
			setOpenPanel(panel);
		},
		[markPanelMounted],
	);

	const handlePanelToggle = useCallback(
		(panel: InputContextPanel) => {
			markPanelMounted(panel);
			setOpenPanel((prev) => {
				if (isTabVariant) {
					return panel;
				}
				return prev === panel ? null : panel;
			});
		},
		[isTabVariant, markPanelMounted],
	);

	const handlePanelClose = useCallback(() => {
		setOpenPanel(null);
	}, []);

	const handleSubmit = useCallback(async () => {
		if (!onSubmit) {
			return;
		}

		if (!controller.hasAnyContext) {
			toast.error(
				"Bitte zuerst Audio aufnehmen, Text eingeben oder Dateien hinzufügen",
			);
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

	const handleTextContextLimitExceeded = useCallback(
		(maxCharacters: number) => {
			toast.error(
				`Textkontext ist zu lang. Maximal ${maxCharacters.toLocaleString("de-DE")} Zeichen möglich.`,
			);
		},
		[],
	);

	const focusFirstTextField = useCallback(() => {
		const scope = panelPortalTarget ?? rootRef.current;
		const textInput = scope?.querySelector<HTMLElement>(
			'[data-input-context-panel="text"] textarea:not(:disabled), [data-input-context-panel="text"] input:not(:disabled)',
		);
		textInput?.focus();
	}, [panelPortalTarget]);

	const handleFocusShortcut = useCallback(() => {
		openContextPanel("text");
		window.requestAnimationFrame(() => {
			if (onFocusShortcut) {
				onFocusShortcut();
				return;
			}
			focusFirstTextField();
		});
	}, [focusFirstTextField, onFocusShortcut, openContextPanel]);

	const handleSubmitShortcut = useCallback(() => {
		if (disabled || isSubmitting || submitShortcutDisabled) {
			return;
		}

		if (onSubmitShortcut) {
			void onSubmitShortcut();
			return;
		}

		if (onSubmit) {
			void handleSubmit();
		}
	}, [
		disabled,
		handleSubmit,
		isSubmitting,
		onSubmit,
		onSubmitShortcut,
		submitShortcutDisabled,
	]);

	const requestRecordingToggle = useCallback(() => {
		if (disabled) {
			return;
		}
		openContextPanel("audio");
		setRecordingShortcutRequest((request) => request + 1);
	}, [disabled, openContextPanel]);

	const {
		handleRootDragEnter,
		handleRootDragLeave,
		handleRootDragOver,
		handleRootDrop,
	} = useInputContextFileDrop({
		controller,
		disabled,
		openContextPanel,
		setDragDepth,
	});

	usePendingRecordingShortcut({
		audioInputRef,
		openPanel,
		recordingShortcutRequest,
	});
	useInputContextHotkeys({
		disabled,
		handleFocusShortcut,
		handleSubmitShortcut,
		hasSubmitShortcut: Boolean(onSubmit || onSubmitShortcut),
		requestRecordingToggle,
	});

	const textPanel = (
		<PanelShell
			description={textPanelDescription}
			isTabVariant={isTabVariant}
			onClose={handlePanelClose}
			panel="text"
			panelPortalTarget={panelPortalTarget}
			title={textPanelTitle}
		>
			{textPanelContent ?? (
				<TextInput
					disabled={isPanelDisabled}
					maxCharacters={FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters}
					onMaxCharactersExceeded={handleTextContextLimitExceeded}
					onValueChange={controller.setTextContext}
					stretchFields={Boolean(panelPortalTarget)}
					value={controller.textContext}
				/>
			)}
		</PanelShell>
	);

	const audioPanel = (
		<PanelShell
			description={`Nimm bis zu ${FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles} Aufnahmen auf. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`}
			isTabVariant={isTabVariant}
			onClose={handlePanelClose}
			panel="audio"
			panelPortalTarget={panelPortalTarget}
			title="Audio"
		>
			<AudioInput
				disabled={isPanelDisabled}
				maxRecordings={controller.effectiveMaxRecordings}
				onRecordingChange={setIsRecordingAudio}
				onValueChange={controller.setAudioRecordings}
				ref={audioInputRef}
				value={controller.audioRecordings}
			/>
		</PanelShell>
	);

	const filePanel = (
		<PanelShell
			description="Füge Dateien als Kontext hinzu und entferne sie wieder, bevor du die Anfrage sendest."
			isTabVariant={isTabVariant}
			onClose={handlePanelClose}
			panel="files"
			panelPortalTarget={panelPortalTarget}
			title="Dateien"
		>
			<DocumentInput
				disabled={isPanelDisabled}
				onAddFiles={controller.addContextFiles}
				onValueChange={controller.setContextFiles}
				value={controller.contextFiles}
			/>
		</PanelShell>
	);

	const panels: Record<InputContextPanel, ReactNode> = {
		audio: audioPanel,
		files: filePanel,
		text: textPanel,
	};
	const renderedActivePanel = renderInputContextPanels({
		isDraggingFiles,
		isTabVariant,
		mountedPanels,
		openPanel,
		panelPortalTarget,
		panels,
	});
	const hasVisibleText = textPanelHasValue ?? controller.hasTextContext;

	return (
		<div
			className={cn("relative w-full space-y-2", className)}
			data-align={isTabVariant ? "block-start" : undefined}
			onDragEnter={handleRootDragEnter}
			onDragLeave={handleRootDragLeave}
			onDragOver={handleRootDragOver}
			onDrop={handleRootDrop}
			ref={rootRef}
		>
			<InputContextDropOverlay active={isDraggingFiles} />
			{renderedActivePanel}

			<InputContextToolbar
				controller={controller}
				handlePanelToggle={handlePanelToggle}
				handleSubmit={handleSubmit}
				hasVisibleText={hasVisibleText}
				isRecordingAudio={isRecordingAudio}
				isSubmitting={isSubmitting}
				isTabVariant={isTabVariant}
				openPanel={openPanel}
				pendingLabel={pendingLabel}
				showSubmit={Boolean(showSubmit && onSubmit)}
				submitLabel={submitLabel}
				title={title}
				trailingAction={trailingAction}
			/>
		</div>
	);
};
