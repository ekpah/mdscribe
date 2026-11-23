"use client";

import { Extension } from "@tiptap/core";
import { DOMSerializer, Fragment, Slice } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
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

/**
 * Markdown edited as it renders: plain formatting without Markdoc tags, in the
 * line layout of `DynamicMarkdocRenderer`'s template layout, saved as Markdown.
 */
export default function MarkdownEditor({
	value,
	onChange,
	onSubmit,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	/** Called on ⌘↵ or Ctrl+↵, which otherwise insert a line break. */
	onSubmit?: () => void;
	/** Classes of the editable surface, such as the rendered view's typography. */
	className?: string;
}) {
	const lastValueRef = useRef(value);
	const onSubmitRef = useRef(onSubmit);
	onSubmitRef.current = onSubmit;
	const editor = useEditor({
		autofocus: "end",
		content: renderTipTapHTML(value),
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
		extensions: [TipTapStarterKit, LineClipboard],
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

	return <EditorContent className="flex flex-1 flex-col" editor={editor} />;
}
