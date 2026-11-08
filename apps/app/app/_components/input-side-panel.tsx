"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import { Eraser, FileText, ListChecks } from "lucide-react";
import type { CitationRequest } from "markdoc-md/citations";
import type { InputTagType } from "markdoc-md/parse";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import type { TemplateFields } from "./inputs/inputs";
import { InputsList } from "./inputs/inputs";

type MobilePanel = "inputs" | "preview";

/** Links the side form to the preview: the field selected in either one. */
export interface SideInputsSelection {
	activeInputFocusKey?: string | number;
	activeInputName?: string | null;
	activePreviewFocusKey?: string | number;
	onInputBlur?: (inputName: string) => void;
	onInputSelect?: (inputName: string) => void;
}

const getMobileTabClassName = (isActive: boolean) =>
	cn(
		"relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border-b px-1 text-muted-foreground transition-colors last:border-b-0 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		isActive && "bg-background text-foreground shadow-xs",
	);

const MobilePanelTab = ({
	controls,
	icon,
	id,
	isActive,
	label,
	onClick,
}: {
	controls: string;
	icon: ReactNode;
	id: string;
	isActive: boolean;
	label: string;
	onClick: () => void;
}) => (
	<button
		aria-controls={controls}
		aria-label={`${label} anzeigen`}
		aria-selected={isActive}
		className={getMobileTabClassName(isActive)}
		id={id}
		onClick={onClick}
		role="tab"
		type="button"
	>
		<span
			className={cn(
				"absolute left-0 h-10 w-1 rounded-r-full",
				isActive ? "bg-primary" : "bg-transparent",
			)}
		/>
		{icon}
		<span className="rotate-180 font-medium text-[11px] leading-none [writing-mode:vertical-rl]">
			{label}
		</span>
	</button>
);

const getInputPanelClassName = (hasInputTags: boolean, mobilePanel: MobilePanel) =>
	cn(
		"min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:col-span-1",
		hasInputTags && mobilePanel === "inputs" && "flex",
		hasInputTags && mobilePanel !== "inputs" && "hidden md:flex",
		!hasInputTags && "hidden",
	);

const getPreviewPanelClassName = (
	hasInputTags: boolean,
	mobilePanel: MobilePanel,
	hasEdgeTabs: boolean,
) =>
	cn(
		"relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4",
		hasInputTags && mobilePanel === "preview" && "flex",
		hasInputTags && mobilePanel !== "preview" && "hidden md:flex",
		!hasInputTags && "flex",
		hasInputTags ? "md:col-span-2 md:border-l" : "md:col-span-3",
		hasEdgeTabs && "pr-14",
	);

/**
 * The input column beside the preview, with the context and fill controls under
 * it. Phones switch between the inputs and the preview with side tabs.
 */
export const InputSidePanelCard = ({
	activeInputFocusKey,
	activeInputName,
	activePreviewFocusKey,
	contentType,
	edgeTabs,
	fields,
	fillControls,
	inputTags,
	onCitationsSelect,
	onInputBlur,
	onInputSelect,
	preview,
	previewPanelElement,
	previewPanelRef,
	previewToolbar,
}: SideInputsSelection & {
	contentType: "document" | "template";
	edgeTabs?: ReactNode;
	fields: TemplateFields;
	fillControls: ReactNode;
	inputTags: InputTagType[];
	onCitationsSelect: (citations: CitationRequest[]) => void;
	preview: ReactNode;
	previewPanelElement: HTMLDivElement | null;
	previewPanelRef: (node: HTMLDivElement | null) => void;
	previewToolbar?: ReactNode;
}) => {
	const [mobilePanel, setMobilePanel] = useState<MobilePanel>("preview");
	const lastInputFocusKeyRef = useRef(activeInputFocusKey);
	const lastPreviewFocusKeyRef = useRef(activePreviewFocusKey);
	const mobileTabId = useId();
	const hasInputTags = inputTags.length > 0;

	useEffect(() => {
		if (!hasInputTags) {
			setMobilePanel("preview");
		}
	}, [hasInputTags]);

	useEffect(() => {
		if (
			activeInputFocusKey !== undefined &&
			!Object.is(lastInputFocusKeyRef.current, activeInputFocusKey)
		) {
			lastInputFocusKeyRef.current = activeInputFocusKey;
			setMobilePanel("inputs");
		}
	}, [activeInputFocusKey]);

	useEffect(() => {
		if (
			activePreviewFocusKey === undefined ||
			Object.is(lastPreviewFocusKeyRef.current, activePreviewFocusKey)
		) {
			return;
		}
		if (mobilePanel !== "preview") {
			return;
		}
		lastPreviewFocusKeyRef.current = activePreviewFocusKey;
		if (!activeInputName || !previewPanelElement) {
			return;
		}
		const activeTag = [
			...previewPanelElement.querySelectorAll<HTMLElement>("[data-markdoc-input]"),
		].find((element) => element.dataset.markdocInput === activeInputName);
		activeTag?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [activeInputName, activePreviewFocusKey, mobilePanel, previewPanelElement]);

	return (
		<Card className="relative flex h-[calc(100dvh-(--spacing(16))-(--spacing(10))-2rem)] overflow-hidden md:grid md:grid-cols-3">
			{hasInputTags ? (
				<div
					aria-label="Mobile Ansicht"
					className="flex w-11 shrink-0 flex-col border-r bg-muted/30 md:hidden"
					role="tablist"
				>
					<MobilePanelTab
						controls={`${mobileTabId}-preview-panel`}
						icon={<FileText aria-hidden className="h-4 w-4" />}
						id={`${mobileTabId}-preview-tab`}
						isActive={mobilePanel === "preview"}
						label="Template"
						onClick={() => setMobilePanel("preview")}
					/>
					<MobilePanelTab
						controls={`${mobileTabId}-inputs-panel`}
						icon={<ListChecks aria-hidden className="h-4 w-4" />}
						id={`${mobileTabId}-inputs-tab`}
						isActive={mobilePanel === "inputs"}
						label="Eingaben"
						onClick={() => setMobilePanel("inputs")}
					/>
				</div>
			) : null}
			<div
				aria-labelledby={hasInputTags ? `${mobileTabId}-inputs-tab` : undefined}
				className={getInputPanelClassName(hasInputTags, mobilePanel)}
				id={`${mobileTabId}-inputs-panel`}
				role={hasInputTags ? "tabpanel" : undefined}
			>
				{contentType === "template" ? (
					<div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
						<span className="font-medium text-muted-foreground text-xs">Eingaben</span>
						<Button
							className="h-7 gap-1.5 px-2 text-muted-foreground text-xs hover:text-foreground"
							onClick={() => fields.reset()}
							size="sm"
							type="button"
							variant="ghost"
						>
							<Eraser aria-hidden className="h-3.5 w-3.5" />
							Alle Eingaben leeren
						</Button>
					</div>
				) : null}
				<div className="min-h-0 flex-1">
					{hasInputTags ? (
						<form className="flex h-full w-full flex-col overflow-hidden">
							<InputsList
								activeInputFocusKey={mobilePanel === "inputs" ? activeInputFocusKey : undefined}
								activeInputName={activeInputName}
								className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-none p-3 pr-3"
								fields={fields}
								inputTags={inputTags}
								onCitationsSelect={onCitationsSelect}
								onInputBlur={onInputBlur}
								onInputSelect={onInputSelect}
							/>
							{fillControls}
						</form>
					) : null}
				</div>
			</div>
			{/* The edge tabs switch the preview's content, so phones hide them over the inputs. */}
			{edgeTabs ? (
				<div
					className={cn("contents", hasInputTags && mobilePanel === "inputs" && "max-md:hidden")}
				>
					{edgeTabs}
				</div>
			) : null}
			<div
				aria-labelledby={hasInputTags ? `${mobileTabId}-preview-tab` : undefined}
				className={getPreviewPanelClassName(hasInputTags, mobilePanel, Boolean(edgeTabs))}
				id={`${mobileTabId}-preview-panel`}
				ref={previewPanelRef}
				role={hasInputTags ? "tabpanel" : undefined}
			>
				{previewToolbar ? (
					<div className="mb-3 flex items-center gap-2">{previewToolbar}</div>
				) : null}
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-none">{preview}</div>
			</div>
		</Card>
	);
};
