"use client";

import type { Editor, NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Merge, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

import { mergeSection } from "./section-merge";

const TITLE_INPUT_SELECTOR = "[data-section-title]";
const DEFAULT_ID_PATTERN = /^abschnitt(?:-\d+)?$/u;

/** A section id derived from its title, e.g. "Körperliche Untersuchung" → "koerperliche-untersuchung". */
const toSectionId = (title: string): string =>
	title
		.toLowerCase()
		.replaceAll("ä", "ae")
		.replaceAll("ö", "oe")
		.replaceAll("ü", "ue")
		.replaceAll("ß", "ss")
		.normalize("NFKD")
		.replaceAll(/[^a-z0-9]+/gu, "-")
		.replaceAll(/^-+|-+$/gu, "");

/** Focuses the title field of the section at `pos` once its node view has mounted. */
export const focusSectionTitle = (editor: Editor, pos: number, frames = 10) => {
	requestAnimationFrame(() => {
		const dom = editor.view.nodeDOM(pos);
		const input =
			dom instanceof HTMLElement ? dom.querySelector<HTMLInputElement>(TITLE_INPUT_SELECTOR) : null;
		if (input) {
			input.focus();
		} else if (frames > 1) {
			// React node views mount asynchronously, later when the whole document was replaced.
			focusSectionTitle(editor, pos, frames - 1);
		}
	});
};

/**
 * A titled box: the title and id are edited inline in its header, the content
 * below like the rest of the document. The id follows the title until it is
 * edited by hand.
 */
export const SectionTagView = ({ editor, getPos, node, updateAttributes }: NodeViewProps) => {
	const id = typeof node.attrs.id === "string" ? node.attrs.id : "";
	const title = typeof node.attrs.title === "string" ? node.attrs.title : "";

	const handleTitleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const nextTitle = event.target.value;
			const followsTitle = !id || DEFAULT_ID_PATTERN.test(id) || id === toSectionId(title);
			updateAttributes({
				title: nextTitle || null,
				...(followsTitle && toSectionId(nextTitle) ? { id: toSectionId(nextTitle) } : {}),
			});
		},
		[id, title, updateAttributes],
	);

	const handleIdChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateAttributes({ id: event.target.value.replaceAll(/[^\w-]/gu, "") });
		},
		[updateAttributes],
	);

	const merge = useCallback(() => {
		const pos = getPos();
		if (typeof pos === "number") {
			mergeSection(editor, pos);
		}
	}, [editor, getPos]);

	return (
		<NodeViewWrapper as="div" className="my-3" data-section-tag="" data-type="markdoc-section">
			{/* Between two sections: shown on hover, always on touch screens; hidden above the first. */}
			<div
				className="-mt-2.5 mb-0.5 flex h-5 items-center gap-2 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100 pointer-coarse:opacity-100 [.ProseMirror>.node-sectionTag:first-child_&]:hidden"
				contentEditable={false}
			>
				<span className="flex-1 border-t border-dashed" />
				<button
					className="inline-flex items-center gap-1 rounded-sm px-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
					onClick={merge}
					title="Mit dem Abschnitt darüber zusammenführen"
					type="button"
				>
					<Merge className="size-3.5" />
					Zusammenführen
				</button>
				<span className="flex-1 border-t border-dashed" />
			</div>
			<div
				className="flex items-center gap-2 rounded-t-md border border-b-0 bg-muted/40 px-2 py-1"
				contentEditable={false}
			>
				<input
					aria-label="Titel des Abschnitts"
					className="min-w-0 flex-1 bg-transparent font-medium text-sm outline-none placeholder:font-normal placeholder:text-muted-foreground placeholder:italic"
					data-section-title=""
					onChange={handleTitleChange}
					placeholder="Titel des Abschnitts"
					spellCheck
					value={title}
				/>
				<input
					aria-label="ID des Abschnitts"
					className="w-40 shrink-0 rounded-sm bg-transparent px-1 text-right font-mono text-muted-foreground text-xs outline-none focus:bg-background"
					onChange={handleIdChange}
					placeholder="id"
					spellCheck={false}
					title="ID des Abschnitts: Buchstaben, Ziffern, - und _"
					value={id}
				/>
				<button
					aria-label="Abschnitt entfernen, Text bleibt erhalten"
					className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
					onClick={merge}
					title="Abschnitt entfernen: der Text kommt in den Abschnitt darüber (⌫ am Anfang)"
					type="button"
				>
					<X className="size-3.5" />
				</button>
			</div>
			<NodeViewContent className="flex flex-col rounded-b-md border px-2 py-1 leading-normal whitespace-normal" />
		</NodeViewWrapper>
	);
};
