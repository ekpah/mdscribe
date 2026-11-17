"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Kbd } from "@repo/design-system/components/ui/kbd";
import { Check, Copy, FileText, LoaderCircle } from "lucide-react";
import { DynamicMarkdocRenderer } from "markdoc-md/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CitationPreviewDialog } from "@/app/_components/citation-preview-dialog";
import { useCase } from "@/app/_components/input-context/case-context";
import { InputContextControls } from "@/app/_components/input-context/input-context-controls";
import type { InputContextSubmission } from "@/app/_components/input-context/types";
import { useCitationPreview } from "@/app/_components/use-citation-preview";
import { TemplateNavigation } from "@/app/templates/_components/template-navigation";
import { copyToClipboard, getRenderedClipboardContent } from "@/lib/rendered-clipboard";

import { DoctorsNoteAgentPanel } from "./doctors-note-agent-panel";
import { DoctorsNoteSection } from "./doctors-note-section";
import type { DoctorsNoteSectionConfig } from "./doctors-note-section";
import {
	collectSectionEvidence,
	getMessageText,
	getSectionTexts,
	useCaseGeneration,
	useCaseInput,
} from "./use-case-generation";

const SECTION_MIN_HEIGHT = 200;

interface DoctorsNoteEditorProps {
	title: string;
	/** The template's `{% section %}` blocks; each one is an editor field. */
	sections: DoctorsNoteSectionConfig[];
	templateId: string;
	/** Optional callback when section values change. */
	onValuesChange?: (values: Record<string, string>) => void;
	/** Optional initial values for sections (keyed by section id). */
	initialValues?: Record<string, string>;
	/** Whether the editor is disabled (e.g. during a global loading state). */
	disabled?: boolean;
	/** Shows the documentation agent beside the letter. */
	showAgent?: boolean;
}

export const DoctorsNoteEditor = ({
	title,
	sections,
	templateId,
	onValuesChange,
	initialValues = {},
	disabled = false,
	showAgent = false,
}: DoctorsNoteEditorProps) => {
	const [sectionValues, setSectionValues] = useState<Record<string, string>>(() => {
		const values: Record<string, string> = {};
		for (const section of sections) {
			values[section.id] = initialValues[section.id] || "";
		}
		return values;
	});
	// The case input is shared by the whole-letter generation and each section's ✨.
	const inputContext = useCase();
	const handleSectionChange = useCallback(
		(sectionId: string, value: string) => {
			setSectionValues((prev) => {
				const next = { ...prev, [sectionId]: value };
				onValuesChange?.(next);
				return next;
			});
		},
		[onValuesChange],
	);

	const sectionChangeHandlers = useMemo(() => {
		const handlers: Record<string, (value: string) => void> = {};
		for (const section of sections) {
			handlers[section.id] = (value: string) => {
				handleSectionChange(section.id, value);
			};
		}
		return handlers;
	}, [sections, handleSectionChange]);

	// Agent edits and the whole-letter generation are staged as per-section
	// proposals, reviewed via the diff editor (accept/reject) rather than applied directly.
	const [agentProposals, setAgentProposals] = useState<Record<string, string>>({});
	const [pendingSuggestionValues, setPendingSuggestionValues] = useState<Record<string, string>>(
		{},
	);

	const handleAgentPropose = useCallback((sectionId: string, content: string) => {
		setAgentProposals((prev) => ({ ...prev, [sectionId]: content }));
		setPendingSuggestionValues((prev) => ({ ...prev, [sectionId]: content }));
	}, []);

	const handleProposalResolved = useCallback((sectionId: string) => {
		setAgentProposals((prev) => {
			if (!(sectionId in prev)) {
				return prev;
			}
			return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== sectionId));
		});
		setPendingSuggestionValues((prev) => {
			if (!(sectionId in prev)) {
				return prev;
			}
			return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== sectionId));
		});
	}, []);

	const handleSuggestionValueChange = useCallback((sectionId: string, value: string | null) => {
		setPendingSuggestionValues((prev) => {
			if (value === null) {
				if (!(sectionId in prev)) {
					return prev;
				}
				return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== sectionId));
			}
			if (prev[sectionId] === value) {
				return prev;
			}
			return { ...prev, [sectionId]: value };
		});
	}, []);

	const proposalResolvedHandlers = useMemo(() => {
		const handlers: Record<string, () => void> = {};
		for (const section of sections) {
			handlers[section.id] = () => {
				handleProposalResolved(section.id);
			};
		}
		return handlers;
	}, [sections, handleProposalResolved]);

	const effectiveSectionValues = useMemo(() => {
		const values = { ...sectionValues };
		for (const [sectionId, suggestion] of Object.entries(pendingSuggestionValues)) {
			values[sectionId] = suggestion;
		}
		return values;
	}, [pendingSuggestionValues, sectionValues]);

	// Context for a section = the other sections' values, keyed by section id.
	const getContextForSection = useCallback(
		(sectionId: string): Record<string, string> => {
			const context: Record<string, string> = {};
			for (const section of sections) {
				if (section.id !== sectionId && effectiveSectionValues[section.id]) {
					context[section.id] = effectiveSectionValues[section.id];
				}
			}
			return context;
		},
		[effectiveSectionValues, sections],
	);

	// Whole letter: one generation answers every section in its `{% section %}` frame.
	// It and each section's ✨ send the same case input, files as OCR text and audio
	// as its transcript once one generation has transcribed it.
	const caseInput = useCaseInput(inputContext);
	const {
		previews: citationPreviews,
		onOpenChange: handleCitationChange,
		prefetch: prefetchCitations,
		selectCitations: showCitations,
	} = useCitationPreview({
		getSources: useCallback(
			() => ({
				files: caseInput.sources.files,
				getOcrResult: (_file: File, citation: { source: string }) =>
					caseInput.sources.ocrResults.get(citation.source),
				texts: caseInput.sources.texts,
			}),
			[caseInput.sources],
		),
	});

	const letter = useCaseGeneration({
		caseInput,
		chatId: `letter-${templateId}`,
		prefetchCitations,
		templateId,
	});
	const isGenerating = letter.isLoading;
	// A template without sections has one section, which an unframed answer fills.
	const soleSectionId = sections.length === 1 ? sections[0]?.id : undefined;
	const generatedSections = useMemo(
		() => getSectionTexts(getMessageText(letter.message), soleSectionId),
		[letter.message, soleSectionId],
	);

	// Each generated section streams into its editor as a proposal to review.
	useEffect(() => {
		for (const section of sections) {
			const text = generatedSections[section.id];
			if (text) {
				handleAgentPropose(section.id, text);
			}
		}
	}, [generatedSections, handleAgentPropose, sections]);

	const evidenceBySection = useMemo(
		() => collectSectionEvidence(letter.message, soleSectionId),
		[letter.message, soleSectionId],
	);
	// From the top bar or ⌘↵ in the sources; the controls hand over a submission they prepared.
	const handleGenerateLetter = useCallback(
		async (submission?: InputContextSubmission) => {
			// A single text is the document itself: its current content is the draft to rewrite.
			await letter.generate(
				soleSectionId
					? {
							sections: { [soleSectionId]: sectionValues[soleSectionId] ?? "" },
							targetSectionId: soleSectionId,
						}
					: {},
				submission,
			);
		},
		[letter, sectionValues, soleSectionId],
	);

	// The copied letter: each written section under its title, rendered like a template;
	// a single section is copied without its title.
	const letterMarkdown = sections
		.filter((section) => effectiveSectionValues[section.id]?.trim())
		.map((section) =>
			soleSectionId
				? (effectiveSectionValues[section.id]?.trim() ?? "")
				: `## ${section.label}\n\n${effectiveSectionValues[section.id]?.trim()}`,
		)
		.join("\n\n");
	const copySourceRef = useRef<HTMLDivElement>(null);
	const [isCopied, setIsCopied] = useState(false);
	const handleCopyLetter = async () => {
		if (
			copySourceRef.current &&
			(await copyToClipboard(getRenderedClipboardContent(copySourceRef.current)))
		) {
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
		}
	};

	const agentSections = sections.map((section) => ({
		content: effectiveSectionValues[section.id] || "",
		id: section.id,
		label: section.label,
	}));

	const soleText = soleSectionId ? (sectionValues[soleSectionId] ?? "") : "";
	const labels = soleSectionId
		? { copy: "Text kopieren", generate: "Generieren" }
		: { copy: "Brief kopieren", generate: "Brief generieren" };
	const canGenerate = !disabled && (inputContext.hasAnyContext || Boolean(soleText.trim()));

	return (
		<div className="flex size-full flex-col overflow-hidden">
			<div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 pt-2 sm:h-10 sm:flex-nowrap">
				<TemplateNavigation aiscribe entry={{ id: templateId, kind: "text", title }} />
				<div className="ml-auto flex shrink-0 items-center gap-1">
					<Button
						render={<Link href={`/templates/${templateId}`} />}
						size="sm"
						title="Vorlage öffnen"
						variant="ghost"
					>
						<FileText aria-hidden className="h-4 w-4" />
						<span className="max-sm:sr-only">Vorlage öffnen</span>
					</Button>
					<Button
						disabled={!canGenerate || isGenerating}
						onClick={() => {
							void handleGenerateLetter();
						}}
						size="sm"
						title="Mit den Quellen generieren (⌘↵)"
					>
						{isGenerating ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : null}
						{labels.generate}
					</Button>
					<Button
						disabled={!letterMarkdown}
						onClick={handleCopyLetter}
						size="sm"
						title={labels.copy}
						variant="outline"
					>
						{isCopied ? (
							<Check aria-hidden className="h-4 w-4" />
						) : (
							<Copy aria-hidden className="h-4 w-4" />
						)}
						<span className="max-sm:sr-only">{labels.copy}</span>
					</Button>
				</div>
			</div>
			{/* The document on the left; its sources on the right, on phones above it. */}
			<div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:overflow-hidden">
				<div className="space-y-6 lg:h-full lg:overflow-y-auto lg:pr-1">
					<div className="space-y-6">
						{sections.map((section) => {
							const sectionChangeHandler = sectionChangeHandlers[section.id];
							if (!sectionChangeHandler) {
								return null;
							}

							return (
								<section className="space-y-2" key={section.id}>
									<h2 className="font-semibold text-foreground text-sm">{section.label}</h2>
									<div className="min-w-0">
										<DoctorsNoteSection
											config={section}
											context={getContextForSection(section.id)}
											disabled={disabled || isGenerating}
											evidence={evidenceBySection[section.id]}
											minHeight={SECTION_MIN_HEIGHT}
											onChange={sectionChangeHandler}
											onCitationSelect={showCitations}
											prefetchCitations={prefetchCitations}
											onProposalResolved={proposalResolvedHandlers[section.id]}
											onSuggestionValueChange={handleSuggestionValueChange}
											proposal={agentProposals[section.id] ?? null}
											caseInput={caseInput}
											hasCaseInput={inputContext.hasAnyContext}
											templateId={templateId}
											value={sectionValues[section.id] || ""}
										/>
									</div>
								</section>
							);
						})}
					</div>

					{/* Footer hint */}
					<div className="flex items-center justify-center gap-4 text-muted-foreground text-xs">
						<div className="flex items-center gap-1.5">
							<Kbd>⌘↵</Kbd>
							<span>zum Verbessern</span>
						</div>
					</div>
					<div hidden>
						<div ref={copySourceRef}>
							<DynamicMarkdocRenderer layout="template" markdocContent={letterMarkdown} />
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-4 max-lg:order-first lg:h-full lg:min-h-0">
					<InputContextControls
						// The sources take the column's full height; Hintergrundinformationen grows.
						className="lg:min-h-0 lg:flex-1"
						controller={inputContext}
						defaultPanel="text"
						disabled={disabled || isGenerating}
						notice={
							<>
								⚠️ <strong>Datenschutz:</strong> Nur anonymisierte Daten eingeben.
							</>
						}
						onSubmit={handleGenerateLetter}
						pendingLabel="Wird generiert…"
						showSubmit={false}
						submitLabel={labels.generate}
						// The document takes the notes; here are only its sources.
						textFields={["background"]}
						title="Quellen"
						variant="tabs"
					/>
					{showAgent && (
						<DoctorsNoteAgentPanel
							background={inputContext.textContext.background ?? ""}
							disabled={disabled}
							onProposeEdit={handleAgentPropose}
							sections={agentSections}
							templateId={templateId}
						/>
					)}
				</div>
			</div>
			<CitationPreviewDialog onOpenChange={handleCitationChange} previews={citationPreviews} />
		</div>
	);
};
