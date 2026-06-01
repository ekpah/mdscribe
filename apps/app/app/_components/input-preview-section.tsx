"use client";

import Inputs from "@repo/design-system/components/inputs/inputs";
import type {
	FillInputsAudioFile,
	FillInputsContextFile,
	FillInputsInputField,
	FillInputsTextContext,
} from "@repo/design-system/components/inputs/inputs";
import { Card } from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { FileText, ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useState } from "react";

import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import {
	InputContextControls,
	useInputContextState,
} from "@/app/_components/input-context/input-context-controls";

type MobilePanel = "inputs" | "preview";

interface InputPreviewSectionProps {
	inputTags: InputTagType[];
	onValuesChange?: (values: Record<string, unknown>) => void;
	preview: (values: Record<string, unknown>) => ReactNode;
	previewToolbar?: ReactNode;
	resetKey?: string;
}

export const InputPreviewSection = ({
	inputTags,
	onValuesChange,
	preview,
	previewToolbar,
	resetKey,
}: InputPreviewSectionProps) => {
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [mobilePanel, setMobilePanel] = useState<MobilePanel>("preview");
	const [previewPanelElement, setPreviewPanelElement] = useState<HTMLDivElement | null>(null);
	const [usesPreviewPanelPortal, setUsesPreviewPanelPortal] = useState(false);
	const inputContextController = useInputContextState();
	const mobileTabId = useId();
	const { data: session } = useSession();
	const isLoggedIn = Boolean(session?.user?.id);
	const hasInputTags = inputTags.length > 0;

	useEffect(() => {
		setValues({});
		onValuesChange?.({});
	}, [onValuesChange, resetKey]);

	useEffect(() => {
		if (!hasInputTags) {
			setMobilePanel("preview");
		}
	}, [hasInputTags]);

	const handleFormChange = useCallback(
		(data: Record<string, unknown>) => {
			setValues(data);
			onValuesChange?.(data);
		},
		[onValuesChange],
	);

	const handlePreviewPanelRef = useCallback((node: HTMLDivElement | null) => {
		setPreviewPanelElement(node);
	}, []);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 768px)");
		const handleChange = () => {
			setUsesPreviewPanelPortal(mediaQuery.matches);
		};

		handleChange();
		mediaQuery.addEventListener("change", handleChange);

		return () => {
			mediaQuery.removeEventListener("change", handleChange);
		};
	}, []);

	const handleFillInputs = useCallback(
		async (
			inputFields: FillInputsInputField[],
			audioFiles: FillInputsAudioFile[],
			textContext: FillInputsTextContext,
			contextFiles: FillInputsContextFile[],
		) => {
			const result = await orpc.scribe.fillInputs.call({
				audioFiles,
				contextFiles,
				inputFields,
				textContext,
			});
			return result.fieldValues;
		},
		[],
	);

	const getMobileTabClassName = (panel: MobilePanel) =>
		cn(
			"relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border-b px-1 text-muted-foreground transition-colors last:border-b-0 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			mobilePanel === panel && "bg-background text-foreground shadow-xs",
		);

	const inputPanelClassName = cn(
		"min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:col-span-1",
		hasInputTags && mobilePanel === "inputs" && "flex",
		hasInputTags && mobilePanel !== "inputs" && "hidden md:flex",
		!hasInputTags && "hidden",
	);

	const previewPanelClassName = cn(
		"relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4",
		hasInputTags && mobilePanel === "preview" && "flex",
		hasInputTags && mobilePanel !== "preview" && "hidden md:flex",
		!hasInputTags && "flex",
		hasInputTags ? "md:col-span-2 md:border-l" : "md:col-span-3",
	);

	return (
		<Card className="relative flex h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] overflow-hidden md:grid md:grid-cols-3">
			{hasInputTags ? (
				<div
					aria-label="Mobile Ansicht"
					className="flex w-11 shrink-0 flex-col border-r bg-muted/30 md:hidden"
					role="tablist"
				>
					<button
						aria-controls={`${mobileTabId}-preview-panel`}
						aria-label="Template anzeigen"
						aria-selected={mobilePanel === "preview"}
						className={getMobileTabClassName("preview")}
						id={`${mobileTabId}-preview-tab`}
						onClick={() => setMobilePanel("preview")}
						role="tab"
						type="button"
					>
						<span
							className={cn(
								"absolute left-0 h-10 w-1 rounded-r-full",
								mobilePanel === "preview" ? "bg-primary" : "bg-transparent",
							)}
						/>
						<FileText aria-hidden className="h-4 w-4" />
						<span className="rotate-180 text-[11px] font-medium leading-none [writing-mode:vertical-rl]">
							Template
						</span>
					</button>
					<button
						aria-controls={`${mobileTabId}-inputs-panel`}
						aria-label="Eingaben anzeigen"
						aria-selected={mobilePanel === "inputs"}
						className={getMobileTabClassName("inputs")}
						id={`${mobileTabId}-inputs-tab`}
						onClick={() => setMobilePanel("inputs")}
						role="tab"
						type="button"
					>
						<span
							className={cn(
								"absolute left-0 h-10 w-1 rounded-r-full",
								mobilePanel === "inputs" ? "bg-primary" : "bg-transparent",
							)}
						/>
						<ListChecks aria-hidden className="h-4 w-4" />
						<span className="rotate-180 text-[11px] font-medium leading-none [writing-mode:vertical-rl]">
							Eingaben
						</span>
					</button>
				</div>
			) : null}
			<div
				aria-labelledby={hasInputTags ? `${mobileTabId}-inputs-tab` : undefined}
				className={inputPanelClassName}
				id={`${mobileTabId}-inputs-panel`}
				key="Inputs"
				role={hasInputTags ? "tabpanel" : undefined}
			>
				<Inputs
					key={resetKey}
					inputTags={inputTags}
					onChange={handleFormChange}
					onFillInputs={isLoggedIn ? handleFillInputs : undefined}
					renderFillControls={({ onSubmit }) => (
						<InputContextControls
							className="shrink-0 border-t border-t-solarized-blue/30 bg-solarized-blue/5 px-4 py-3"
							controller={inputContextController}
							onSubmit={async ({ audioFiles, contextFiles, textContext }) => {
								await onSubmit(audioFiles, textContext, contextFiles);
							}}
							panelPortalTarget={
								usesPreviewPanelPortal ? previewPanelElement : null
							}
						/>
					)}
					showFillInputs={isLoggedIn}
				/>
			</div>
			<div
				aria-labelledby={hasInputTags ? `${mobileTabId}-preview-tab` : undefined}
				className={previewPanelClassName}
				id={`${mobileTabId}-preview-panel`}
				key="Preview"
				ref={handlePreviewPanelRef}
				role={hasInputTags ? "tabpanel" : undefined}
			>
				{previewToolbar ? (
					<div className="mb-3 flex items-center gap-2">{previewToolbar}</div>
				) : null}
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
					{preview(values)}
				</div>
			</div>
		</Card>
	);
};
