"use client";

import {
	enableKeyboardNavigation,
} from "@harshtalks/slash-tiptap";
import { MarkdocMD } from "@repo/design-system/components/editor/tiptap-extension";
import { cn } from "@repo/design-system/lib/utils";
import { htmlToMarkdoc } from "@repo/markdoc-md/parse/html-to-markdoc";
import { renderTipTapHTML } from "@repo/markdoc-md/render/utils/render-markdoc-as-tip-tap-html";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import TipTapMenu from "./_components/tip-tap-menu";

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
		autofocus: true,
		content: renderTipTapHTML(note),
		editorProps: {
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
			handleDOMEvents: {
				keydown: (_, v) => enableKeyboardNavigation(v),
			},
		},
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
		immediatelyRender: false,
		injectCSS: false,
		onUpdate: ({ editor }) => {
			// Get the HTML and convert to markdoc format
			const html = editor.getHTML();
			setContent(htmlToMarkdoc(html));
		},
	});

	// Wrap toggle to sync content before switching views
	const handleToggleSource = useCallback(() => {
		if (editor && onToggleSource) {
			// Force sync content before switching to source view
			const html = editor.getHTML();
			setContent(htmlToMarkdoc(html));
			// Small delay to ensure state is updated before view switch
			setTimeout(() => {
				onToggleSource();
			}, 0);
		}
	}, [editor, onToggleSource, setContent]);

	if (!editor) {
		return null;
	}

	const handleEditorSurfaceMouseDown = useCallback((
		event: MouseEvent<HTMLDivElement>,
	) => {
		if (event.target !== event.currentTarget) {
			return;
		}

		event.preventDefault();
		editor.chain().focus().run();
	}, [editor]);

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
