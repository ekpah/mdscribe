"use client";

import {
	createSuggestionsItems,
	enableKeyboardNavigation,
} from "@harshtalks/slash-tiptap";
import { MarkdocMD } from "@repo/design-system/components/editor/tiptap-extension";
import { cn } from "@repo/design-system/lib/utils";
import { htmlToMarkdoc } from "@repo/markdoc-md/parse/htmlToMarkdoc";
import { renderTipTapHTML } from "@repo/markdoc-md/render/utils/renderMarkdocAsTipTapHTML";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import TipTapMenu from "./_components/TipTapMenu";

const suggestions = createSuggestionsItems([
	{
		title: "Info-Tag",
		searchTerms: ["info"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertContent({
					type: "infoTag",
					attrs: {
						primary: "...",
					},
				})
				.setNodeSelection(range.from)
				.run();
		},
	},
	{
		title: "Switch-Tag",
		searchTerms: ["switch"],
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertContent({
					type: "switchTag",
					attrs: {
						primary: "...",
					},
				})
				.run();
		},
	},
]);

export default function TipTap({
	note,
	setContent,
	onValidationChange,
}: {
	note: string;
	setContent: (content: string) => void;
	onValidationChange?: (errors: any[]) => void;
}) {
	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit,
			Markdown,
			MarkdocMD,
			// Placeholder.configure({
			//   placeholder: ({ node }) => {
			//     return 'Ergänze hier deinen Textbaustein...';
			//   },
			// }),
		],
		content: renderTipTapHTML(note),
		onUpdate: ({ editor }) => {
			const markdown = editor.getMarkdown();
			setContent(htmlToMarkdoc(markdown));
		},
		editorProps: {
			handleDOMEvents: {
				keydown: (_, v) => enableKeyboardNavigation(v),
			},
			attributes: {
				class: cn(
					"prose min-h-full w-full max-w-none whitespace-pre-wrap focus:outline-none",
					"[&_.is-empty]:relative",
					"[&_.is-empty]:before:content-[attr(data-placeholder)]",
					"[&_.is-empty]:before:text-slate-400",
					"[&_.is-empty]:before:float-left",
					"[&_.is-empty]:before:h-0",
					"[&_.is-empty]:before:pointer-events-none",
				),
			},
		},
		autofocus: true,
		injectCSS: false,
	});

	if (!editor) {
		return null;
	}

	return (
		<div className="flex h-full w-full flex-col overflow-hidden">
			<div className="shrink-0">
				<TipTapMenu editor={editor} />
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-3">
				<EditorContent editor={editor} />
			</div>
		</div>
	);
}
