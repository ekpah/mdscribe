"use client";

import { cn } from "@repo/design-system/lib/utils";
import { Markdown } from "@tiptap/markdown";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import TipTapStarterKit from "@tiptap/starter-kit";
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";
import { type MarkdocTagDiagnostic, validateMarkdocTagContracts } from "markdoc-md/parse";
import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent } from "react";

import TipTapMenu from "./tip-tap-menu";
import { MarkdocMD } from "./tiptap-extension";
import { ensureCalcFormulaComponents } from "./tiptap-extension/editorNodes/calcTag/calc-tag";

const MARKDOC_INPUT_TAG_PATTERN = /\{%\s*(?:calc|info|score|switch)\b/iu;
const TIPTAP_INPUT_ELEMENT_PATTERN = /<(?:Calc|Info|Score|Switch)\b/iu;

export default function TipTap({
	note,
	setContent,
	onEditorChange,
	onValidationChange,
}: {
	note: string;
	setContent: (content: string) => void;
	/** Reports the live editor instance, e.g. to drive the tag inspector. */
	onEditorChange?: (editor: Editor | null) => void;
	/** Reports semantic Markdoc tag conflicts without loading Markdoc in the parent bundle. */
	onValidationChange?: (diagnostics: MarkdocTagDiagnostic[]) => void;
}) {
	const lastEditorContentRef = useRef(note);
	const editor = useEditor({
		autofocus: true,
		content: renderTipTapHTML(note),
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-sm h-full min-h-full w-full max-w-none cursor-text whitespace-pre-wrap text-sm leading-[1.45] focus:outline-none",
					"[&_p]:my-0 [&_p]:leading-[1.45]",
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
			setContent(markdocContent);
			onValidationChange?.(validateMarkdocTagContracts(markdocContent));
		},
	});

	useEffect(() => {
		if (!editor || note === lastEditorContentRef.current) {
			return;
		}

		lastEditorContentRef.current = note;
		editor.commands.setContent(renderTipTapHTML(note), { emitUpdate: false });
		onValidationChange?.(validateMarkdocTagContracts(note));
	}, [editor, note, onValidationChange]);

	useEffect(() => {
		if (!onEditorChange) {
			return;
		}

		onEditorChange(editor);

		return () => {
			onEditorChange(null);
		};
	}, [editor, onEditorChange]);

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
		<div className="flex h-full w-full flex-col overflow-hidden">
			<div className="shrink-0">
				<TipTapMenu editor={editor} />
			</div>
			<div
				className="min-h-0 flex-1 overflow-y-auto p-3"
				onMouseDown={handleEditorSurfaceMouseDown}
				role="none"
			>
				<EditorContent
					className="h-full [&_.ProseMirror]:h-full [&_.ProseMirror]:min-h-full"
					editor={editor}
				/>
			</div>
		</div>
	);
}
