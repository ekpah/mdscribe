"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDown, FileText, Mic, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { FILL_INPUT_PAYLOAD_LIMITS, formatPayloadBytes } from "@/lib/input-fill-limits";

import { AudioInput } from "./inputs/audio/audio-input";
import { DocumentInput } from "./inputs/document/document-input";
import { TextInput } from "./inputs/text/text-input";
import type { InputContextController, InputContextPanel, InputContextSubmission } from "./types";

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
		placementClassName = "static min-h-[min(68svh,36rem)] rounded-t-lg shadow-none";
	} else if (hasPortalTarget) {
		placementClassName = "absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-none";
	}

	return cn("z-20 bg-solarized-blue/10 p-4 shadow-lg backdrop-blur", placementClassName);
};

const PanelShell = ({
	children,
	description,
	isTabVariant,
	onClose,
	panelPortalTarget,
	title,
}: {
	children: ReactNode;
	description: string;
	isTabVariant: boolean;
	onClose: () => void;
	panelPortalTarget?: HTMLElement | null;
	title: string;
}) => (
	<div
		className={getPanelShellClassName({
			hasPortalTarget: Boolean(panelPortalTarget),
			isTabVariant,
		})}
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
	onClick,
	title,
}: {
	ariaLabel: string;
	hasValue: boolean;
	icon: ReactNode;
	isActive: boolean;
	onClick: () => void;
	title?: string;
}) => (
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
		{hasValue ? (
			<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-solarized-green" />
		) : null}
	</Button>
);

const renderActivePanel = ({
	activePanel,
	isTabVariant,
	panelPortalTarget,
}: {
	activePanel: ReactNode;
	isTabVariant: boolean;
	panelPortalTarget?: HTMLElement | null;
}) => {
	if (!activePanel) {
		return null;
	}

	if (panelPortalTarget && !isTabVariant) {
		return createPortal(activePanel, panelPortalTarget);
	}

	return activePanel;
};

const ToolbarTitle = ({ title }: { title?: string }) => {
	if (title) {
		return (
			<div className="min-w-0 flex-1">
				<span className="truncate font-medium text-foreground text-xs">{title}</span>
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
			className={cn("h-9 shrink-0 px-3 text-xs", hasTrailingAction ? undefined : "ml-auto")}
			disabled={disabled}
			onClick={onClick}
			type="button"
			variant="default"
		>
			{isSubmitting ? pendingLabel : submitLabel}
		</Button>
	);
};

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
	const [openPanel, setOpenPanel] = useState<InputContextPanel | null>(defaultPanel);
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

	const handleTextSubmitShortcut = useCallback(() => {
		if (controller.hasAnyContext && !isSubmitting) {
			void handleSubmit();
		}
	}, [controller.hasAnyContext, handleSubmit, isSubmitting]);

	const handleTextContextLimitExceeded = useCallback((maxCharacters: number) => {
		toast.error(
			`Textkontext ist zu lang. Maximal ${maxCharacters.toLocaleString("de-DE")} Zeichen möglich.`,
		);
	}, []);

	const textPanel = (
		<PanelShell
			description={textPanelDescription}
			isTabVariant={isTabVariant}
			onClose={handlePanelClose}
			panelPortalTarget={panelPortalTarget}
			title={textPanelTitle}
		>
			{textPanelContent ?? (
				<TextInput
					disabled={isPanelDisabled}
					maxCharacters={FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters}
					onMaxCharactersExceeded={handleTextContextLimitExceeded}
					onSubmitShortcut={handleTextSubmitShortcut}
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
			panelPortalTarget={panelPortalTarget}
			title="Audio"
		>
			<AudioInput
				disabled={isPanelDisabled}
				maxRecordings={controller.effectiveMaxRecordings}
				onValueChange={controller.setAudioRecordings}
				value={controller.audioRecordings}
			/>
		</PanelShell>
	);

	const filePanel = (
		<PanelShell
			description="Füge Dateien als Kontext hinzu und entferne sie wieder, bevor du die Anfrage sendest."
			isTabVariant={isTabVariant}
			onClose={handlePanelClose}
			panelPortalTarget={panelPortalTarget}
			title="Dateien"
		>
			<DocumentInput
				disabled={isPanelDisabled}
				onValueChange={controller.setContextFiles}
				value={controller.contextFiles}
			/>
		</PanelShell>
	);

	const activePanel = openPanel
		? { audio: audioPanel, files: filePanel, text: textPanel }[openPanel]
		: null;
	const renderedActivePanel = renderActivePanel({
		activePanel,
		isTabVariant,
		panelPortalTarget,
	});
	const hasVisibleText = textPanelHasValue ?? controller.hasTextContext;

	return (
		<div
			className={cn("relative w-full space-y-2", className)}
			data-align={isTabVariant ? "block-start" : undefined}
		>
			{renderedActivePanel}

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
						ariaLabel="Audio-Kontext öffnen"
						hasValue={controller.hasAudioRecordings}
					icon={<Mic className="h-4 w-4" />}
					isActive={openPanel === "audio"}
					onClick={() => {
						handlePanelToggle("audio");
					}}
					title="Audio-Kontext öffnen"
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
					canShow={Boolean(showSubmit && onSubmit)}
					disabled={!controller.hasAnyContext || isSubmitting}
					hasTrailingAction={Boolean(trailingAction)}
					isSubmitting={isSubmitting}
					onClick={handleSubmit}
					pendingLabel={pendingLabel}
					submitLabel={submitLabel}
				/>
			</div>
		</div>
	);
};
