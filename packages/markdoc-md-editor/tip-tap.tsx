"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { cn } from "@repo/design-system/lib/utils";
import { Markdown } from "@tiptap/markdown";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import TipTapStarterKit from "@tiptap/starter-kit";
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";
import { validateMarkdocTagContracts } from "markdoc-md/parse";
import type { MarkdocTagDiagnostic } from "markdoc-md/parse";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";

import { TAG_COLORS } from "./tag-colors";
import { updateMarkdocTagAttributes } from "./tag-inspector/use-selected-markdoc-tag";
import TipTapMenu from "./tip-tap-menu";
import { MarkdocMD } from "./tiptap-extension";
import { ensureCalcFormulaComponents } from "./tiptap-extension/editorNodes/calcTag/calc-tag";
import { formatCaseConditionLabel } from "./tiptap-extension/editorNodes/case-condition";
import type { SwitchCase } from "./tiptap-extension/editorNodes/switchTag/switch-tag";

const MARKDOC_INPUT_TAG_PATTERN = /\{%\s*(?:calc|info|score|switch)\b/iu;
const TIPTAP_INPUT_ELEMENT_PATTERN = /<(?:Calc|Info|Score|Switch)\b/iu;

export default function TipTap({
	note,
	setContent,
	onEditorChange,
	onValidationChange,
	autofocus = true,
	onInspectEditor,
}: {
	note: string;
	setContent: (content: string, html: string) => void;
	autofocus?: boolean;
	/** Reports the live editor instance, e.g. to drive the tag inspector. */
	onEditorChange?: (editor: Editor | null) => void;
	/** Reports semantic Markdoc tag conflicts without loading Markdoc in the parent bundle. */
	onValidationChange?: (diagnostics: MarkdocTagDiagnostic[]) => void;
	/** Nested documents report the editor owning the clicked tag to the outer inspector. */
	onInspectEditor?: (editor: Editor) => void;
}) {
	const lastEditorContentRef = useRef(note);
	const [openSwitch, setOpenSwitch] = useState<{
		pos: number;
		caseIndex: number;
		host: Element;
	} | null>(null);
	const [inspectedEditor, setInspectedEditor] = useState<Editor | null>(null);
	const inspectEditor = onInspectEditor ?? setInspectedEditor;
	const editor = useEditor({
		autofocus,
		content: renderTipTapHTML(note),
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-sm w-full max-w-none cursor-text whitespace-pre-wrap text-sm leading-[1.45] focus:outline-none",
					onInspectEditor ? "min-h-20" : "min-h-full",
					"[&_p]:my-0 [&_p]:leading-[1.45]",
					// injectCSS is disabled: restore ProseMirror's hidden native selection
					// for NodeSelection, leaving the chip's own ring as the only highlight.
					"[&.ProseMirror-hideselection]:caret-transparent [&.ProseMirror-hideselection_*]:selection:bg-transparent [&.ProseMirror-hideselection]:selection:bg-transparent",
					"[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:leading-tight",
					"[&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:leading-tight",
					"[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:leading-tight",
					"[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_li]:leading-[1.45]",
					"[&_.ProseMirror-separator]:!m-0 [&_.ProseMirror-separator]:!inline [&_.ProseMirror-separator]:!size-0 [&_.ProseMirror-separator]:!border-0",
					"[&_.is-empty]:relative",
					"[&_.is-empty]:before:content-[attr(data-placeholder)]",
					"[&_.is-empty]:before:text-slate-400",
					"[&_.is-empty]:before:float-left",
					"[&_.is-empty]:before:h-0",
					"[&_.is-empty]:before:pointer-events-none",
				),
			},
			handleKeyDown: (view, event) => {
				// Native document-boundary navigation can escape nested contenteditables
				// into the outer editor. Keep these shortcuts in the active case.
				if (
					onInspectEditor &&
					(event.ctrlKey || event.metaKey) &&
					(event.key === "Home" || event.key === "End")
				) {
					const selection =
						event.key === "Home"
							? TextSelection.atStart(view.state.doc)
							: TextSelection.atEnd(view.state.doc);
					view.dispatch(
						view.state.tr
							.setSelection(
								event.shiftKey
									? TextSelection.create(
											view.state.doc,
											view.state.selection.anchor,
											selection.head,
										)
									: selection,
							)
							.scrollIntoView(),
					);
					return true;
				}
				return false;
			},
			handlePaste: (view, event) => {
				const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
				if (!MARKDOC_INPUT_TAG_PATTERN.test(clipboardText)) {
					return false;
				}

				const html = renderTipTapHTML(clipboardText);
				if (!TIPTAP_INPUT_ELEMENT_PATTERN.test(html)) {
					return false;
				}

				const container = document.createElement("div");
				container.innerHTML = html;
				const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(container, {
					preserveWhitespace: true,
				});

				event.preventDefault();
				view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
				return true;
			},
		},
		extensions: [
			TipTapStarterKit,
			Markdown,
			MarkdocMD,
			// Placeholder.configure({
			//   placeholder: ({ node }) => {
			//     return 'Ergänze hier deinen Textbaustein...';
			//   },
			// }),
		],
		immediatelyRender: false,
		injectCSS: false,
		onCreate: ({ editor: createdEditor }) => {
			const transaction = createdEditor.state.tr;
			if (ensureCalcFormulaComponents(transaction)) {
				createdEditor.view.dispatch(transaction);
				return;
			}
			onValidationChange?.(validateMarkdocTagContracts(note));
		},
		onFocus: ({ editor: focusedEditor, event }) => {
			if (event.target === focusedEditor.view.dom) {
				inspectEditor(focusedEditor);
			}
		},
		onUpdate: ({ editor: updatedEditor }) => {
			const transaction = updatedEditor.state.tr;
			if (ensureCalcFormulaComponents(transaction)) {
				updatedEditor.view.dispatch(transaction);
				return;
			}
			// Get the HTML and convert to markdoc format
			const html = updatedEditor.getHTML();
			const markdocContent = htmlToMarkdoc(html);
			lastEditorContentRef.current = markdocContent;
			setContent(markdocContent, html);
			onValidationChange?.(validateMarkdocTagContracts(markdocContent));
		},
	});

	useEffect(() => {
		if (!editor || note === lastEditorContentRef.current) {
			return;
		}

		lastEditorContentRef.current = note;
		setOpenSwitch(null);
		setInspectedEditor(null);
		editor.commands.setContent(renderTipTapHTML(note), { emitUpdate: false });
		onValidationChange?.(validateMarkdocTagContracts(note));
	}, [editor, note, onValidationChange]);

	useEffect(() => {
		if (!onEditorChange) {
			return;
		}

		onEditorChange(inspectedEditor ?? editor);

		return () => {
			onEditorChange(null);
		};
	}, [editor, inspectedEditor, onEditorChange]);

	// Keep the open node anchored when settings or undo change the parent document.
	useEffect(() => {
		if (!editor) {
			return;
		}
		const mapOpenSwitch = ({ transaction }: { transaction: Transaction }) => {
			if (!transaction.docChanged) {
				return;
			}
			setOpenSwitch((current) => {
				if (!current) {
					return null;
				}
				const pos = transaction.mapping.map(current.pos);
				return transaction.doc.nodeAt(pos)?.type.name === "switchTag" ? { ...current, pos } : null;
			});
		};
		editor.on("transaction", mapOpenSwitch);
		return () => {
			editor.off("transaction", mapOpenSwitch);
		};
	}, [editor]);
	const switchNode = useEditorState({
		editor,
		selector: ({ editor: current }) =>
			openSwitch ? current?.state.doc.nodeAt(openSwitch.pos) : null,
	});
	const cases = (switchNode?.attrs.cases ?? []) as SwitchCase[];
	const caseIndex = Math.min(openSwitch?.caseIndex ?? 0, Math.max(0, cases.length - 1));
	const activeCase = cases[caseIndex];
	const closeSwitch = () => {
		setOpenSwitch(null);
		if (editor) {
			inspectEditor(editor);
		}
	};

	const handleEditorSurfaceMouseDown = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (event.target !== event.currentTarget) {
				return;
			}
			if (!editor) {
				return;
			}

			event.preventDefault();
			editor.chain().focus().run();
		},
		[editor],
	);

	if (!editor) {
		return null;
	}

	return (
		<div
			className={cn("flex w-full flex-col", onInspectEditor ? "h-auto" : "h-full overflow-hidden")}
			data-markdoc-editor-root={onInspectEditor ? undefined : ""}
			onClickCapture={(event) => {
				const target = event.target as HTMLElement;
				const chip = target.closest<HTMLButtonElement>("button[data-type^='markdoc-']");
				if (!chip || chip.closest(".tiptap") !== editor.view.dom) {
					return;
				}
				inspectEditor(editor);
				if (chip.dataset.type === "markdoc-switch") {
					// The chip selects its node on mousedown; keyboard clicks select on click.
					const wrapper = chip.closest("[data-node-view-wrapper]");
					if (!wrapper) {
						return;
					}
					const pos = editor.view.posAtDOM(wrapper, 0);
					const host = wrapper.querySelector("[data-switch-expansion]");
					if (host) {
						setOpenSwitch((current) =>
							current?.host === host ? current : { caseIndex: 0, host, pos },
						);
					}
				}
			}}
		>
			{openSwitch && switchNode
				? createPortal(
						<div
							className={cn(
								"not-prose relative flex w-full flex-col overflow-hidden rounded-md rounded-tl-none border whitespace-normal leading-normal",
								TAG_COLORS.green.surface,
							)}
							data-testid="switch-content-editor"
						>
							<Button
								className="absolute top-1 right-1 z-10"
								size="sm"
								variant="ghost"
								onClick={closeSwitch}
							>
								Zuklappen
							</Button>
							{activeCase ? (
								<Tabs
									className="min-h-0 flex-1 gap-0"
									value={caseIndex}
									onValueChange={(value) => {
										setOpenSwitch({ ...openSwitch, caseIndex: Number(value) });
										inspectEditor(editor);
									}}
								>
									<div className="shrink-0 overflow-x-auto border-b p-2 pr-24">
										<TabsList aria-label="Switch-Optionen">
											{cases.map((item, index) => (
												<TabsTrigger key={index} value={index}>
													{item.primary || formatCaseConditionLabel(item) || `Option ${index + 1}`}
												</TabsTrigger>
											))}
										</TabsList>
									</div>
									<TabsContent className="min-h-0" value={caseIndex}>
										<TipTap
											key={caseIndex}
											autofocus={false}
											note={htmlToMarkdoc(activeCase.content ?? activeCase.text)}
											onInspectEditor={inspectEditor}
											setContent={(_content, html) => {
												// Store the editor HTML directly. Rendering Markdown on every
												// keystroke would normalize away an unfinished trailing space.
												const container = document.createElement("div");
												container.innerHTML = html;
												updateMarkdocTagAttributes(editor, openSwitch.pos, {
													cases: cases.map((item, index) =>
														index === caseIndex
															? { ...item, content: html, text: container.textContent ?? "" }
															: item,
													),
												});
											}}
										/>
									</TabsContent>
								</Tabs>
							) : (
								<p className="p-3 pr-24 text-sm text-muted-foreground">
									Optionen rechts in den Switch-Eigenschaften hinzufügen.
								</p>
							)}
						</div>,
						openSwitch.host,
					)
				: null}
			{!onInspectEditor && (
				<div className="shrink-0">
					<TipTapMenu
						editor={inspectedEditor && !inspectedEditor.isDestroyed ? inspectedEditor : editor}
					/>
				</div>
			)}
			<div
				className={cn("p-3", !onInspectEditor && "min-h-0 flex-1 overflow-y-auto")}
				onMouseDown={handleEditorSurfaceMouseDown}
				role="none"
			>
				<EditorContent className="min-h-full" editor={editor} />
			</div>
		</div>
	);
}
