"use client";

import { Extension } from "@tiptap/core";
import { DOMSerializer, Fragment, Slice } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import TipTapStarterKit from "@tiptap/starter-kit";
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";
import { useEffect, useRef } from "react";

const lineBreakText = (leaf: ProseMirrorNode) => (leaf.type.name === "hardBreak" ? "\n" : "");

/** Plain text with one line per paragraph or line break, as it shows, and list markers. */
const toLines = (fragment: Fragment): string[] => {
	const lines: string[] = [];
	fragment.forEach((node) => {
		if (node.isTextblock) {
			lines.push(...node.textBetween(0, node.content.size, "", lineBreakText).split("\n"));
		} else if (node.type.name === "bulletList" || node.type.name === "orderedList") {
			let number = Number(node.attrs.start ?? 1);
			node.forEach((item) => {
				const marker = node.type.name === "orderedList" ? `${number++}. ` : "- ";
				for (const [index, line] of toLines(item.content).entries()) {
					lines.push((index === 0 ? marker : " ".repeat(marker.length)) + line);
				}
			});
		} else {
			lines.push(...toLines(node.content));
		}
	});
	return lines;
};

/**
 * The editor's lines are paragraphs and an empty one is an empty line. Copies keep
 * that: rich text without paragraph spacing, plain text with one line per line,
 * and pasted plain text becomes one paragraph per line, empty lines included.
 */
const LineClipboard = Extension.create({
	name: "lineClipboard",
	// Ahead of TipTap's own text serializer, which separates paragraphs with an empty line.
	priority: 1000,
	addProseMirrorPlugins() {
		const { schema } = this.editor;
		const base = DOMSerializer.fromSchema(schema);
		const lineStyle = { style: "margin: 0" };
		const clipboardSerializer = new DOMSerializer(
			{
				...base.nodes,
				paragraph: (node) =>
					node.content.size > 0 ? ["p", lineStyle, 0] : ["p", lineStyle, "\u00A0"],
			},
			base.marks,
		);
		return [
			new Plugin({
				props: {
					clipboardSerializer,
					clipboardTextParser: (text) =>
						Slice.maxOpen(
							Fragment.from(
								text
									.replaceAll(/\r\n?/gu, "\n")
									.replace(/\n$/u, "")
									.split("\n")
									.map((line) =>
										schema.nodes.paragraph.create(null, line ? schema.text(line) : null),
									),
							),
						),
					clipboardTextSerializer: (slice) => toLines(slice.content).join("\n"),
				},
			}),
		];
	},
});

/** A passage of the text, such as a cited statement, marked and opened on click. */
export interface MarkdownEditorHighlight {
	/** The passage as Markdown; each of its lines is found within one line of the editor. */
	text: string;
	onSelect: () => void;
}

const NO_HIGHLIGHTS: readonly MarkdownEditorHighlight[] = [];
const HIGHLIGHT_ATTRIBUTE = "data-editor-highlight";
const highlightsKey = new PluginKey<DecorationSet>("highlights");

/** The passage's lines as they show: without list markers, heading marks and bold or code delimiters. */
const visibleLines = (markdown: string) =>
	markdown
		.split("\n")
		.map((line) =>
			line
				.replace(/^\s*(?:[-+*]|\d+[.)])\s+/u, "")
				.replace(/^\s*#{1,6}\s+/u, "")
				.replaceAll(/\*\*|__|`/gu, "")
				.trim(),
		)
		.filter(Boolean);

const decorateHighlights = (
	doc: ProseMirrorNode,
	highlights: readonly MarkdownEditorHighlight[],
	className: string,
) => {
	// Each line's text with the document position of every character.
	const lines: { positions: number[]; text: string }[] = [];
	doc.descendants((node, pos) => {
		if (!node.isTextblock) {
			return true;
		}
		let line = { positions: [] as number[], text: "" };
		lines.push(line);
		node.forEach((child, offset) => {
			const start = pos + 1 + offset;
			if (child.type.name === "hardBreak") {
				line = { positions: [], text: "" };
				lines.push(line);
			} else if (child.isText) {
				line.text += child.text ?? "";
				for (let index = 0; index < child.nodeSize; index++) {
					line.positions.push(start + index);
				}
			}
		});
		return false;
	});
	const decorations: Decoration[] = [];
	for (const [index, highlight] of highlights.entries()) {
		for (const part of visibleLines(highlight.text)) {
			for (const line of lines) {
				const at = line.text.indexOf(part);
				if (at !== -1) {
					decorations.push(
						Decoration.inline(line.positions[at], line.positions[at + part.length - 1] + 1, {
							class: className,
							[HIGHLIGHT_ATTRIBUTE]: String(index),
						}),
					);
					break;
				}
			}
		}
	}
	return DecorationSet.create(doc, decorations);
};

/**
 * Marks the highlights in the text. A click on one opens it while the editor is
 * not focused; while typing, a click places the caret and ⌘/Ctrl-click opens it.
 */
const Highlights = Extension.create<{
	className: string;
	highlights: { current: readonly MarkdownEditorHighlight[] };
}>({
	name: "highlights",
	addOptions: () => ({ className: "", highlights: { current: [] } }),
	addProseMirrorPlugins() {
		const { className, highlights } = this.options;
		return [
			new Plugin<DecorationSet>({
				key: highlightsKey,
				props: {
					decorations: (state) => highlightsKey.getState(state),
					handleDOMEvents: {
						mousedown: (view, event) => {
							const mark =
								event.target instanceof Element && event.target.closest(`[${HIGHLIGHT_ATTRIBUTE}]`);
							if (
								!mark ||
								event.button !== 0 ||
								(view.hasFocus() && !event.metaKey && !event.ctrlKey)
							) {
								return false;
							}
							event.preventDefault();
							highlights.current[Number(mark.getAttribute(HIGHLIGHT_ATTRIBUTE))]?.onSelect();
							return true;
						},
					},
				},
				state: {
					apply: (transaction, decorations, _old, state) =>
						transaction.docChanged || transaction.getMeta(highlightsKey)
							? decorateHighlights(state.doc, highlights.current, className)
							: decorations,
					init: (_config, state) => decorateHighlights(state.doc, highlights.current, className),
				},
			}),
		];
	},
});

/**
 * Markdown edited as it renders: plain formatting without Markdoc tags, in the
 * line layout of `DynamicMarkdocRenderer`'s template layout, saved as Markdown.
 */
export default function MarkdownEditor({
	value,
	onChange,
	onSubmit,
	className,
	autofocus = false,
	editable = true,
	highlights = NO_HIGHLIGHTS,
	highlightClassName = "",
}: {
	value: string;
	onChange: (value: string) => void;
	/** Called on ⌘↵ or Ctrl+↵, which otherwise insert a line break. */
	onSubmit?: () => void;
	/** Classes of the editable surface, such as the rendered view's typography. */
	className?: string;
	/** Focuses the end of the text once the editor is ready. */
	autofocus?: boolean;
	editable?: boolean;
	/** Passages marked in the text, such as cited statements; they do not change the value. */
	highlights?: readonly MarkdownEditorHighlight[];
	/** Classes of a marked passage. */
	highlightClassName?: string;
}) {
	const lastValueRef = useRef(value);
	const onSubmitRef = useRef(onSubmit);
	onSubmitRef.current = onSubmit;
	const highlightsRef = useRef(highlights);
	const editor = useEditor({
		autofocus: autofocus ? "end" : false,
		content: renderTipTapHTML(value),
		editable,
		editorProps: {
			attributes: { class: className ?? "" },
			handleKeyDown: (_view, event) => {
				if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || !onSubmitRef.current) {
					return false;
				}
				// Handled here alone, not again by a hotkey of the surrounding page.
				event.stopPropagation();
				onSubmitRef.current();
				return true;
			},
		},
		extensions: [
			TipTapStarterKit,
			LineClipboard,
			Highlights.configure({ className: highlightClassName, highlights: highlightsRef }),
		],
		immediatelyRender: false,
		onUpdate: ({ editor: updatedEditor }) => {
			lastValueRef.current = htmlToMarkdoc(updatedEditor.getHTML());
			onChange(lastValueRef.current);
		},
	});

	useEffect(() => {
		if (editor && value !== lastValueRef.current) {
			lastValueRef.current = value;
			editor.commands.setContent(renderTipTapHTML(value), { emitUpdate: false });
		}
	}, [editor, value]);

	useEffect(() => {
		editor?.setEditable(editable, false);
	}, [editable, editor]);

	useEffect(() => {
		highlightsRef.current = highlights;
		editor?.view.dispatch(editor.state.tr.setMeta(highlightsKey, true));
	}, [editor, highlights]);

	return <EditorContent className="flex flex-1 flex-col" editor={editor} />;
}
