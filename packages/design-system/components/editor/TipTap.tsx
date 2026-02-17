"use client";

import {
	createSuggestionsItems,
	enableKeyboardNavigation,
} from "@harshtalks/slash-tiptap";
import { placeCaretAfterInsertedInlineTag } from "@repo/design-system/components/editor/_lib/placeCaretAfterInsertedInlineTag";
import { MarkdocMD } from "@repo/design-system/components/editor/tiptap-extension";
import { cn } from "@repo/design-system/lib/utils";
import { htmlToMarkdoc } from "@repo/markdoc-md/parse/htmlToMarkdoc";
import { renderTipTapHTML } from "@repo/markdoc-md/render/utils/renderMarkdocAsTipTapHTML";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import type { MouseEvent } from "react";
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
				.command(placeCaretAfterInsertedInlineTag)
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
						cases: [{ primary: "", text: "..." }],
					},
				})
				.command(placeCaretAfterInsertedInlineTag)
				.run();
		},
	},
]);

export default function TipTap({
	note,
	setContent,
	showSource,
	onToggleSource,
}: {
	note: string;
	setContent: (content: string) => void;
	showSource?: boolean;
	onToggleSource?: () => void;
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
			// Get the HTML and convert to markdoc format
			const html = editor.getHTML();
			setContent(htmlToMarkdoc(html));
		},
		editorProps: {
			handleDOMEvents: {
				keydown: (_, v) => enableKeyboardNavigation(v),
			},
			attributes: {
				class: cn(
					"prose h-full min-h-full w-full max-w-none cursor-text whitespace-pre-wrap focus:outline-none",
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

	// Wrap toggle to sync content before switching views
	const handleToggleSource = () => {
		if (editor && onToggleSource) {
			// Force sync content before switching to source view
			const html = editor.getHTML();
			setContent(htmlToMarkdoc(html));
			// Small delay to ensure state is updated before view switch
			setTimeout(() => {
				onToggleSource();
			}, 0);
		}
	};

	if (!editor) {
		return null;
	}

	const handleEditorSurfaceMouseDown = (
		event: MouseEvent<HTMLDivElement>,
	) => {
		if (event.target !== event.currentTarget) {
			return;
		}

		event.preventDefault();
		editor.chain().focus().run();
	};

	return (
		<div className="flex h-full w-full flex-col overflow-hidden">
			<div className="shrink-0">
				<TipTapMenu
					editor={editor}
					onToggleSource={handleToggleSource}
					showSource={showSource}
				/>
			</div>
			<div
				className="min-h-0 flex-1 overflow-y-auto p-3"
				onMouseDown={handleEditorSurfaceMouseDown}
			>
				<EditorContent
					className="h-full [&_.ProseMirror]:h-full [&_.ProseMirror]:min-h-full"
					editor={editor}
				/>
			</div>
		</div>
	);
}
