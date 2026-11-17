"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { Fragment } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Plus, Sparkles } from "lucide-react";
import { registerMarkdocEditorPlugin } from "markdoc-md-editor/plugins";
import type { MarkdocEditorPlugin } from "markdoc-md-editor/plugins";

import { templateTags } from "../config";
import { validateTemplateSections } from "../sections";
import { AiBlockTag, AiTag } from "./ai-tag";
import { templateTagRenderers } from "./renderers";
import { isEmptyParagraph } from "./section-merge";
import { SectionTag } from "./section-tag";
import { focusSectionTitle } from "./section-tag-view";

/**
 * Appends an empty section. Top-level text outside the sections joins the section
 * before it (or after it, at the start), so the first click puts the whole text in
 * the first section.
 */
const addSection = (editor: Editor) => {
	const { doc, schema } = editor.state;
	const ids = new Set<string>();
	for (const node of doc.children) {
		if (node.type.name === "sectionTag") {
			ids.add(String(node.attrs.id));
		}
	}
	const newSection = (content: ProseMirrorNode[]) => {
		let number = ids.size + 1;
		while (ids.has(`abschnitt-${number}`)) {
			number += 1;
		}
		ids.add(`abschnitt-${number}`);
		return schema.nodes.sectionTag.create(
			{ id: `abschnitt-${number}`, title: null },
			content.length ? content : schema.nodes.paragraph.create(),
		);
	};
	const sections: ProseMirrorNode[] = [];
	let loose: ProseMirrorNode[] = [];
	for (const node of doc.children) {
		if (node.type.name !== "sectionTag") {
			if (!isEmptyParagraph(node)) {
				loose.push(node);
			}
			continue;
		}
		const previous = sections.at(-1);
		if (loose.length && previous) {
			sections[sections.length - 1] = previous.copy(previous.content.append(Fragment.from(loose)));
		}
		sections.push(
			loose.length && !previous ? node.copy(Fragment.from(loose).append(node.content)) : node,
		);
		loose = [];
	}
	const last = sections.at(-1);
	if (!last) {
		sections.push(newSection(loose));
	} else if (loose.length) {
		sections[sections.length - 1] = last.copy(last.content.append(Fragment.from(loose)));
	}
	// The editor may add a trailing paragraph, so the new section's position comes from its predecessors.
	const pos = sections.reduce((size, section) => size + section.nodeSize, 0);
	sections.push(newSection([]));
	editor.view.dispatch(editor.state.tr.replaceWith(0, doc.content.size, sections));
	focusSectionTitle(editor, pos);
};

const Toolbar = ({
	editor,
	tagButtonClassName,
}: {
	editor: Editor;
	tagButtonClassName: string;
}) => {
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			aiActive: current.isActive("aiTag"),
			canToggleAi: current.can().toggleAiTag(),
		}),
	});
	return (
		<Button
			aria-pressed={state.aiActive}
			className={cn(
				tagButtonClassName,
				"bg-solarized-magenta hover:bg-solarized-magenta/90",
				state.aiActive && "ring-2 ring-solarized-magenta/40 ring-offset-1",
			)}
			disabled={!state.canToggleAi}
			onClick={() => editor.chain().focus().toggleAiTag().run()}
			size="sm"
			title="KI-Anweisung: wird befolgt, aber nicht ausgegeben. Auch ((…)) tippen."
			type="button"
			variant="ghost"
		>
			<span>KI</span>
		</Button>
	);
};

/** Below the text: adds a section, the way a template becomes a multi-part letter. */
const Footer = ({ editor }: { editor: Editor }) => (
	<Button
		className="mt-2 text-muted-foreground"
		onClick={() => addSection(editor)}
		size="sm"
		title="Abschnitt: ein Teil des Dokuments, z. B. die Anamnese eines Briefs"
		type="button"
		variant="ghost"
	>
		<Plus className="size-4" />
		Neuer Abschnitt
	</Button>
);

const Help = () => (
	<div className="space-y-3">
		<div className="flex items-center gap-2">
			<Sparkles className="h-4 w-4 text-solarized-magenta" />
			<h4 className="font-semibold text-sm">KI-Anleitung und Abschnitte</h4>
		</div>
		<div className="space-y-3 rounded-lg bg-solarized-magenta/5 p-3">
			<div className="space-y-1.5">
				<div className="flex items-center gap-2">
					<Badge
						className="border-solarized-magenta bg-solarized-magenta/10 font-mono text-solarized-magenta text-xs"
						variant="outline"
					>
						{"{% ai %}…{% /ai %}"}
					</Badge>
					<span className="font-medium text-xs">KI-Anweisungen</span>
				</div>
				<p className="text-muted-foreground text-xs leading-relaxed">
					Anweisungen an die KI, etwa wie ein Absatz formuliert wird. Tippen Sie{" "}
					<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">((Anweisung))</code> oder
					nutzen Sie den „KI“-Knopf: Der Text wird zur KI-Anweisung. Sie ist ausgegraut sichtbar,
					wird beim Generieren befolgt und beim Kopieren entfernt.
				</p>
			</div>
			<div className="space-y-1.5">
				<div className="flex items-center gap-2">
					<Badge className="bg-foreground/70 text-xs">Abschnitt</Badge>
					<span className="font-medium text-xs">Teil eines Dokuments</span>
				</div>
				<p className="text-muted-foreground text-xs leading-relaxed">
					Teilt ein Dokument in benannte Abschnitte, z. B. Diagnosen, Anamnese und Epikrise eines
					Briefs. Beim Generieren entsteht jeder Abschnitt als eigenes Feld. Abschnitte stehen auf
					oberster Ebene; „Neuer Abschnitt“ unter dem Text legt einen an, und der übrige Text kommt
					in den ersten Abschnitt. ✕ im Kopf, „Zusammenführen“ zwischen zwei Abschnitten oder ⌫ am
					Anfang eines Abschnitts führt ihn mit dem darüber zusammen; „Rückgängig“ im Hinweis stellt
					ihn wieder her.
				</p>
			</div>
		</div>
	</div>
);

/** The app's `ai` and `section` tags in the template editor. */
const templateTagsEditorPlugin: MarkdocEditorPlugin = {
	Footer,
	Help,
	Toolbar,
	extensions: [AiTag, AiBlockTag, SectionTag],
	renderers: templateTagRenderers,
	tags: templateTags,
	validate: validateTemplateSections,
};

registerMarkdocEditorPlugin(templateTagsEditorPlugin);
