"use client";
import { Extension } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import CodeBlock from "@tiptap/extension-code-block";
import History from "@tiptap/extension-history";
import Text from "@tiptap/extension-text";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Pencil } from "lucide-react";
import { useEffect } from "react";

type MarkdocDiagnostic = {
	from: number;
	to: number;
	message: string;
};

const markdocErrorStyle =
	"text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: hsl(1 71% 52%);";

const markdocErrorPluginKey = new PluginKey<DecorationSet>("markdoc-errors");

const buildErrorDecorations = (
	doc: ProseMirrorNode,
	diagnostics: MarkdocDiagnostic[],
) => {
	if (diagnostics.length === 0) {
		return DecorationSet.empty;
	}

	const decorations: Decoration[] = [];
	let offset = 0;

	doc.descendants((node, pos) => {
		if (!node.isText) {
			return;
		}

		const text = node.text ?? "";
		if (text.length === 0) {
			return;
		}

		const nodeStart = offset;
		const nodeEnd = nodeStart + text.length;

		for (const diagnostic of diagnostics) {
			if (diagnostic.to <= nodeStart || diagnostic.from >= nodeEnd) {
				continue;
			}

			const from = pos + Math.max(0, diagnostic.from - nodeStart);
			const to = pos + Math.min(text.length, diagnostic.to - nodeStart);

			if (from >= to) {
				continue;
			}

			decorations.push(
				Decoration.inline(from, to, {
					style: markdocErrorStyle,
					title: diagnostic.message,
				}),
			);
		}

		offset = nodeEnd;
	});

	return DecorationSet.create(doc, decorations);
};

const MarkdocErrorHighlight = Extension.create({
	name: "markdoc-error-highlight",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: markdocErrorPluginKey,
				state: {
					init: () => DecorationSet.empty,
					apply(tr, decorationSet) {
						const diagnostics = tr.getMeta(markdocErrorPluginKey) as
							| MarkdocDiagnostic[]
							| undefined;
						if (diagnostics) {
							return buildErrorDecorations(tr.doc, diagnostics);
						}
						if (tr.docChanged) {
							return decorationSet.map(tr.mapping, tr.doc);
						}
						return decorationSet;
					},
				},
				props: {
					decorations(state) {
						return markdocErrorPluginKey.getState(state) ?? DecorationSet.empty;
					},
				},
			}),
		];
	},
});

const SourceDocument = Document.extend({
	content: "codeBlock",
});

const buildDocContent = (value: string) => ({
	type: "doc",
	content: [
		{
			type: "codeBlock",
			content: value ? [{ type: "text", text: value }] : [],
		},
	],
});

export default function PlainEditor({
	note,
	setContent,
	onToggleSource,
	diagnostics = [],
}: {
	note: string;
	setContent: (content: string) => void;
	onToggleSource?: () => void;
	diagnostics?: MarkdocDiagnostic[];
}) {
	const editor = useEditor({
		immediatelyRender: false,
		extensions: [SourceDocument, CodeBlock, Text, History, MarkdocErrorHighlight],
		content: buildDocContent(note),
		onUpdate: ({ editor }) => {
			setContent(editor.getText());
		},
		editorProps: {
			attributes: {
				class:
					"h-full w-full font-mono text-sm text-foreground focus:outline-none [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-0 [&_code]:font-inherit [&_code]:whitespace-pre-wrap",
				spellcheck: "false",
			},
		},
	});

	useEffect(() => {
		if (!editor) {
			return;
		}

		const currentText = editor.getText();
		if (currentText !== note) {
			editor.commands.setContent(buildDocContent(note), false);
		}
	}, [editor, note]);

	useEffect(() => {
		if (!editor) {
			return;
		}

		editor.view.dispatch(
			editor.state.tr.setMeta(markdocErrorPluginKey, diagnostics),
		);
	}, [diagnostics, editor]);

	return (
		<div className="flex h-full w-full flex-col overflow-hidden">
			{/* Menu bar matching TipTapMenu height */}
			<div className="mb-2 flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-muted/90 p-2">
				<div className="flex flex-wrap gap-1">
					<TooltipProvider>
						<Tooltip delayDuration={200}>
							<TooltipTrigger className="h-8 bg-transparent px-2 text-muted-foreground">
								<span className="font-mono text-sm">Markdoc Quelltext</span>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p>Bearbeite den Markdoc-Quelltext direkt</p>
								<p className="mt-1">
									<a
										className="text-primary hover:underline"
										href="https://docs.mdscribe.de/templates/tags"
										rel="noopener noreferrer"
										target="_blank"
									>
										Erfahre mehr →
									</a>
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>

				{/* Source Toggle - Right aligned */}
				{onToggleSource !== undefined && (
					<div className="ml-auto flex items-center">
						<button
							className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium"
							onClick={onToggleSource}
							type="button"
						>
							<Pencil className="h-4 w-4" />
							<span className="hidden sm:inline">Editor anzeigen</span>
						</button>
					</div>
				)}
			</div>

			{/* Editor Content */}
			<div className="min-h-0 flex-1 overflow-y-auto p-3">
				{editor ? <EditorContent editor={editor} /> : null}
			</div>
		</div>
	);
}
