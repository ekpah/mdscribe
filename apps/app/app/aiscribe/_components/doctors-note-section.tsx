"use client";

import { SuggestionDiff } from "@repo/design-system/components/editor/diff-editor";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { cn } from "@repo/design-system/lib/utils";
import { Check, Loader2, Pencil, Sparkles } from "lucide-react";
import type { CitationRequest } from "markdoc-md/citations";
import { DynamicMarkdocRenderer } from "markdoc-md/react";
import dynamic from "next/dynamic";
import type { ClipboardEvent, MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";

import { addScribeCitations } from "@/features/response-citations/markup";
import type { ScribeCitation } from "@/features/response-citations/markup";
import { getRenderedClipboardContent } from "@/lib/rendered-clipboard";
import { USER_MESSAGES } from "@/lib/user-messages";

import {
	collectSectionEvidence,
	getMessageText,
	getSectionTexts,
	useCaseGeneration,
} from "./use-case-generation";
import type { CaseInput, SectionEvidence } from "./use-case-generation";

const MIN_HEIGHT = 120;

// Loaded on first edit, so reading a letter does not ship the editor.
const MarkdownEditor = dynamic(() => import("markdoc-md-editor/markdown-editor"), {
	loading: () => <Skeleton className="h-full min-h-20 w-full" />,
	ssr: false,
});

/** Typography of the section text, shared by the rendered view and the editor, so editing does not move it. */
const SECTION_TEXT_CLASS =
	"prose prose-slate prose-sm max-w-none text-sm leading-[1.45] [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0";

/** One `{% section %}` of the letter's template. */
export interface DoctorsNoteSectionConfig {
	id: string;
	label: string;
	/** Shown while the section is empty when the template has no text for it. */
	placeholder: string;
	/** The section's text in the template, shown as its placeholder. */
	template?: string;
}

/** Where each cited statement of `evidence` is in `text`; of overlapping ones, the earlier one. */
const locateCitations = (text: string, evidence: SectionEvidence[]): ScribeCitation[] => {
	const located = evidence
		.flatMap(({ citations, text: cited }) => {
			const at = text.indexOf(cited);
			return at === -1 ? [] : [{ citations, end: at + cited.length, start: at }];
		})
		.toSorted((a, b) => a.start - b.start);
	return located.filter((mark, index) => index === 0 || mark.start >= located[index - 1].end);
};

/** `text[start, end)` of a suggestion with each cited statement as a mark that opens its sources. */
const renderCitedRange = (
	text: string,
	start: number,
	end: number,
	evidence: SectionEvidence[],
	onSelect: (citations: CitationRequest[]) => void,
): ReactNode[] => {
	const nodes: ReactNode[] = [];
	let cursor = start;
	for (const mark of locateCitations(text, evidence)) {
		const from = Math.max(mark.start, start);
		const to = Math.min(mark.end, end);
		if (from >= to) {
			continue;
		}
		if (from > cursor) {
			nodes.push(text.slice(cursor, from));
		}
		// A mark like markdoc-md's `cite`, not a <button>: Chrome lays buttons out as inline
		// blocks, so a statement spanning lines would push the following punctuation onto its own line.
		nodes.push(
			<mark
				className="cursor-pointer whitespace-pre-wrap bg-transparent text-inherit underline decoration-dotted decoration-solarized-blue/50 underline-offset-4 hover:bg-solarized-blue/10 focus-visible:outline-2 focus-visible:outline-solarized-blue"
				data-citation-source=""
				key={`${from}-${to}`}
				onClick={() => onSelect(mark.citations)}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onSelect(mark.citations);
					}
				}}
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-to-interactive-role -- a <button> cannot wrap across lines
				role="button"
				tabIndex={0}
				title="Quelle anzeigen"
			>
				{text.slice(from, to)}
			</mark>,
		);
		cursor = to;
	}
	if (cursor < end) {
		nodes.push(text.slice(cursor, end));
	}
	return nodes;
};

const NO_EVIDENCE: SectionEvidence[] = [];

/** Copies the selected text as "Brief kopieren" does: its lines, list markers and rich text, without citations. */
const copySelection = (event: ClipboardEvent<HTMLElement>) => {
	const selection = window.getSelection();
	const range = selection && !selection.isCollapsed ? selection.getRangeAt(0) : null;
	if (!range || !event.currentTarget.contains(range.commonAncestorContainer)) {
		return;
	}
	const selected = document.createElement("div");
	selected.append(range.cloneContents());
	const { html, text } = getRenderedClipboardContent(selected);
	event.clipboardData.setData("text/html", html);
	event.clipboardData.setData("text/plain", text);
	event.preventDefault();
};

/**
 * A click anywhere in a section starts editing, except on its controls and citations
 * or when it ends a text selection; the pencil button does the same from the keyboard.
 */
const isPlainClick = (event: MouseEvent<HTMLElement>) =>
	!(event.target instanceof Element && event.target.closest("button, a, [role='button']")) &&
	window.getSelection()?.isCollapsed !== false;

/** The template's text for an empty section, or a generic prompt, behind the empty editor. */
const SectionPlaceholder = ({
	isLoading,
	placeholder,
	template,
	value,
}: {
	isLoading: boolean;
	placeholder: string;
	template?: string;
	value: string;
}) =>
	value.trim() ? null : (
		<div
			aria-hidden
			className="pointer-events-none absolute top-2 right-20 left-3 select-none text-muted-foreground opacity-70"
		>
			{!isLoading && template?.trim() ? (
				<DynamicMarkdocRenderer
					className={cn(SECTION_TEXT_CLASS, "text-muted-foreground [&_*]:text-inherit")}
					layout="template"
					markdocContent={template}
				/>
			) : (
				<p className="text-sm">{isLoading ? "Wird generiert..." : placeholder}</p>
			)}
		</div>
	);

/** The section text: rendered with its citations, or in the editor while editing. */
const SectionText = ({
	citedValue,
	isEditing,
	onChange,
	onCitationSelect,
	onSubmit,
	value,
}: {
	citedValue: string;
	isEditing: boolean;
	onChange: (value: string) => void;
	onCitationSelect?: (citations: CitationRequest[]) => void;
	onSubmit: () => void;
	value: string;
}) => {
	if (isEditing) {
		return (
			<MarkdownEditor
				className={cn(SECTION_TEXT_CLASS, "min-h-20 flex-1 focus:outline-none")}
				onChange={onChange}
				onSubmit={onSubmit}
				value={value}
			/>
		);
	}
	if (!value.trim()) {
		return null;
	}
	return (
		<div
			className="[&_mark[data-citation-source]]:underline [&_mark[data-citation-source]]:decoration-solarized-blue/50 [&_mark[data-citation-source]]:decoration-dotted [&_mark[data-citation-source]]:underline-offset-4"
			onCopy={copySelection}
		>
			<DynamicMarkdocRenderer
				className={SECTION_TEXT_CLASS}
				layout="template"
				markdocContent={citedValue}
				onCitationSelect={onCitationSelect}
			/>
		</div>
	);
};

const TOOL_BUTTON_CLASS = cn(
	"rounded-md p-1.5 transition-all hover:bg-solarized-blue/10",
	"opacity-50 hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-30",
);

/** Edit toggle and generate button, top right of the section. */
const SectionTools = ({
	canEdit,
	canEnhance,
	isEditing,
	isLoading,
	onEnhance,
	onToggleEditing,
}: {
	canEdit: boolean;
	canEnhance: boolean;
	isEditing: boolean;
	isLoading: boolean;
	onEnhance: () => void;
	onToggleEditing: () => void;
}) => {
	const EditIcon = isEditing ? Check : Pencil;
	const EnhanceIcon = isLoading ? Loader2 : Sparkles;
	return (
		<div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
			<button
				aria-pressed={isEditing}
				className={cn(TOOL_BUTTON_CLASS, isEditing && "opacity-100")}
				disabled={!canEdit}
				onClick={onToggleEditing}
				title={isEditing ? "Bearbeiten beenden" : "Bearbeiten"}
				type="button"
			>
				<EditIcon className="h-4 w-4 text-solarized-blue" />
			</button>
			<button
				className={cn(TOOL_BUTTON_CLASS, isLoading && "opacity-100")}
				disabled={!canEnhance && !isLoading}
				onClick={onEnhance}
				title={isLoading ? "Wird generiert..." : "Mit KI generieren/verbessern (⌘↵)"}
				type="button"
			>
				<EnhanceIcon className={cn("h-4 w-4 text-solarized-blue", isLoading && "animate-spin")} />
			</button>
		</div>
	);
};

interface DoctorsNoteSectionProps {
	/** The letter's case input: text, files (as OCR text) and audio (as transcript once available). */
	caseInput: CaseInput;
	/** Whether the case input holds any text, files or audio. */
	hasCaseInput: boolean;
	/** Cited statements of the last whole-letter generation in this section. */
	evidence?: SectionEvidence[];
	onCitationSelect?: (citations: CitationRequest[]) => void;
	/** Locates the document quotes of the section's own answer before a click. */
	prefetchCitations?: (citations: CitationRequest[]) => void;
	config: DoctorsNoteSectionConfig;
	templateId: string;
	value: string;
	onChange: (value: string) => void;
	/** Context from other sections (keyed by section id) */
	context: Record<string, string>;
	disabled?: boolean;
	/** Minimum editor height in pixels. Defaults to MIN_HEIGHT. */
	minHeight?: number;
	/**
	 * External proposed content (e.g. from the agent) shown as a diff for the
	 * user to accept/reject. Takes precedence over the section's own enhance flow.
	 */
	proposal?: string | null;
	/** Called after an external proposal is accepted or rejected. */
	onProposalResolved?: () => void;
	/** Reports the currently suggested value so sibling/agent context can use it before approval. */
	onSuggestionValueChange?: (sectionId: string, value: string | null) => void;
}

export const DoctorsNoteSection = ({
	caseInput,
	hasCaseInput,
	evidence = NO_EVIDENCE,
	onCitationSelect,
	prefetchCitations,
	config,
	templateId,
	value,
	onChange,
	context,
	disabled = false,
	minHeight = MIN_HEIGHT,
	proposal = null,
	onProposalResolved,
	onSuggestionValueChange,
}: DoctorsNoteSectionProps) => {
	const [proposedText, setProposedText] = useState<string | null>(null);
	const generation = useCaseGeneration({
		caseInput,
		chatId: `section-${config.id}`,
		onError: () => setProposedText(null),
		prefetchCitations,
		templateId,
	});
	const { isLoading, message, stop } = generation;

	// The model answers in this section's frame; an unframed answer is used as is.
	const completion = useMemo(
		() => getSectionTexts(getMessageText(message), config.id)[config.id] ?? "",
		[config.id, message],
	);
	const ownEvidence = useMemo(
		() => collectSectionEvidence(message, config.id)[config.id] ?? [],
		[config.id, message],
	);

	const hasAnyInput =
		hasCaseInput || [value, ...Object.values(context)].some((text) => text.trim());

	// Update proposed text as completion streams in
	useEffect(() => {
		if (isLoading && completion) {
			setProposedText(completion);
		}
	}, [completion, isLoading]);

	const { generate } = generation;
	const handleEnhance = useCallback(() => {
		if (isLoading) {
			stop();
			return;
		}

		if (!hasAnyInput) {
			toast.error(USER_MESSAGES.missingInput);
			return;
		}

		// The section's own draft goes in its slot of the document; the model rewrites it,
		// with the whole case input as for the letter.
		setProposedText("");
		void generate({
			sections: { ...context, [config.id]: value },
			targetSectionId: config.id,
		});
	}, [isLoading, stop, config.id, value, context, hasAnyInput, generate]);

	// External (agent) proposals take precedence over the section's own enhance.
	const effectiveProposal = proposal ?? proposedText;

	useEffect(() => {
		onSuggestionValueChange?.(config.id, effectiveProposal);
	}, [config.id, effectiveProposal, onSuggestionValueChange]);

	// Clear proposed text after a suggestion is accepted or rejected; the answer's
	// citations stay for the statements that remain.
	const handleSuggestionHandled = useCallback(() => {
		setProposedText(null);
		onProposalResolved?.();
	}, [onProposalResolved]);

	const [isEditing, setIsEditing] = useState(false);
	const canEnhance = !disabled && !isLoading;
	const isInDiffMode = effectiveProposal !== null;
	const canEdit = !disabled && !isLoading && !isInDiffMode;
	// A citation stays marked as long as its exact text survives editing.
	const shownText = effectiveProposal ?? value;
	const shownEvidence = useMemo(
		() => [...evidence, ...ownEvidence].filter(({ text }) => shownText.includes(text)),
		[evidence, ownEvidence, shownText],
	);
	const citedValue = useMemo(
		() =>
			onCitationSelect ? addScribeCitations(value, locateCitations(value, shownEvidence)) : value,
		[onCitationSelect, shownEvidence, value],
	);

	const startEditingOnClick = (event: MouseEvent<HTMLDivElement>) => {
		if (canEdit && !isEditing && isPlainClick(event)) {
			setIsEditing(true);
		}
	};

	const hotkeyRef = useHotkeys<HTMLDivElement>(
		["meta+enter", "ctrl+enter"],
		(event) => {
			event.preventDefault();
			handleEnhance();
		},
		{ enableOnContentEditable: true, enabled: !disabled && !isInDiffMode },
	);

	if (isInDiffMode) {
		return (
			<div className="relative h-full">
				{isLoading && (
					<span className="absolute top-2 left-3 z-10 text-muted-foreground text-xs">
						Wird generiert...
					</span>
				)}
				<SuggestionDiff
					isStreaming={isLoading}
					minHeight={minHeight}
					onChange={onChange}
					onSuggestionAccepted={handleSuggestionHandled}
					onSuggestionRejected={handleSuggestionHandled}
					renderRange={
						shownEvidence.length > 0 && onCitationSelect
							? (text, start, end) =>
									renderCitedRange(text, start, end, shownEvidence, onCitationSelect)
							: undefined
					}
					suggestedValue={effectiveProposal}
					value={value}
				/>
			</div>
		);
	}

	return (
		// oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the pencil button is the keyboard path
		<div
			className={cn(
				"relative flex w-full flex-col rounded-md border bg-background px-3 py-2 pr-20 shadow-xs",
				isEditing ? "border-solarized-blue ring-1 ring-solarized-blue/20" : "border-input",
				canEdit && !isEditing && "cursor-text",
				disabled && "opacity-50",
			)}
			id={`section-${config.id}`}
			onClick={startEditingOnClick}
			ref={hotkeyRef}
			style={{ minHeight }}
		>
			<SectionPlaceholder
				isLoading={isLoading}
				placeholder={config.placeholder}
				template={config.template}
				value={value}
			/>
			<SectionText
				citedValue={citedValue}
				isEditing={isEditing}
				onChange={onChange}
				onCitationSelect={onCitationSelect}
				onSubmit={handleEnhance}
				value={value}
			/>
			<SectionTools
				canEdit={canEdit}
				canEnhance={canEnhance}
				isEditing={isEditing}
				isLoading={isLoading}
				onEnhance={handleEnhance}
				onToggleEditing={() => setIsEditing((editing) => !editing)}
			/>
		</div>
	);
};
