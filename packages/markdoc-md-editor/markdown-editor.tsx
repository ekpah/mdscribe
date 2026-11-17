"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import TipTapStarterKit from "@tiptap/starter-kit";
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";
import { useEffect, useRef } from "react";

/**
 * Markdown edited as it renders: plain formatting without Markdoc tags, in the
 * line layout of `DynamicMarkdocRenderer`'s template layout, saved as Markdown.
 */
export default function MarkdownEditor({
	value,
	onChange,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	/** Classes of the editable surface, such as the rendered view's typography. */
	className?: string;
}) {
	const lastValueRef = useRef(value);
	const editor = useEditor({
		autofocus: "end",
		content: renderTipTapHTML(value),
		editorProps: { attributes: { class: className ?? "" } },
		extensions: [TipTapStarterKit],
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

	return <EditorContent editor={editor} />;
}
