"use client";

import {
	enableKeyboardNavigation,
} from "@harshtalks/slash-tiptap";
import { MarkdocMD } from '@repo/design-system/components/editor/tiptap-extension';
import { cn } from "@repo/design-system/lib/utils";
import { htmlToMarkdoc } from "@repo/markdoc-md/parse/html-to-markdoc";
import { renderTipTapHTML } from "@repo/markdoc-md/render/utils/render-markdoc-as-tip-tap-html";
import { EditorContent, useEditor } from "@tiptap/react";
import TipTapStarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useCallback } from "react";
import type { MouseEvent } from "react";
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
					"prose prose-sm h-full min-h-full w-full max-w-none cursor-text whitespace-pre-wrap text-sm leading-[1.45] focus:outline-none",
					"[&_p]:my-0 [&_p]:leading-[1.45]",
					"[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:leading-tight",
					"[&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:leading-tight",
					"[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:leading-tight",
					"[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_li]:leading-[1.45]",
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
		onUpdate: ({ editor: updatedEditor }) => {
			// Get the HTML and convert to markdoc format
			const html = updatedEditor.getHTML();
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
				<TipTapMenu
					editor={editor}
					onToggleSource={handleToggleSource}
					showSource={showSource}
				/>
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
