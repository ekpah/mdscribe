"use client";

import {
	enableKeyboardNavigation,
} from "@harshtalks/slash-tiptap";
import {
	MarkdocMD,
	MarkdocValidation,
	type MarkdocValidationHighlight,
} from "@repo/design-system/components/editor/tiptap-extension";
import { cn } from "@repo/design-system/lib/utils";
import { htmlToMarkdoc } from "@repo/markdoc-md/parse/html-to-markdoc";
import { renderTipTapHTML } from "@repo/markdoc-md/render/utils/render-markdoc-as-tip-tap-html";
import { EditorContent, useEditor } from "@tiptap/react";
import TipTapStarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useCallback, useEffect } from "react";
import type { MouseEvent } from "react";
import TipTapMenu from "./_components/tip-tap-menu";

export default function TipTap({
	note,
	setContent,
	validationHighlights = [],
	showSource,
	onToggleSource,
}: {
	note: string;
	setContent: (content: string) => void;
	validationHighlights?: MarkdocValidationHighlight[];
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
			TipTapStarterKit,
			Markdown,
			MarkdocMD,
			MarkdocValidation,
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

	useEffect(() => {
		if (!editor) {
			return;
		}

		editor.commands.setMarkdocValidation(validationHighlights);
	}, [editor, validationHighlights]);

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
