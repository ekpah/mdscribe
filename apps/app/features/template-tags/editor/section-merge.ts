import { closeHistory } from "@tiptap/pm/history";
import { Fragment } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

const isSection = (node: ProseMirrorNode | null | undefined): node is ProseMirrorNode =>
	node?.type.name === "sectionTag";

const sectionName = (node: ProseMirrorNode) =>
	String(node.attrs.title || node.attrs.id || "Abschnitt");

export const isEmptyParagraph = (block: ProseMirrorNode | undefined) =>
	block?.type.name === "paragraph" && block.content.size === 0;

const nodesSize = (nodes: ProseMirrorNode[]) =>
	nodes.reduce((sum, block) => sum + block.nodeSize, 0);

/** The blocks of a section without empty paragraphs at its start and end. */
const trimmedBlocks = (node: ProseMirrorNode): ProseMirrorNode[] => {
	const blocks = [...node.children];
	while (isEmptyParagraph(blocks[0])) {
		blocks.shift();
	}
	while (isEmptyParagraph(blocks.at(-1))) {
		blocks.pop();
	}
	return blocks;
};

/**
 * A document has two or more sections or none: a sole top-level section becomes
 * plain text. Returns whether it changed `tr`.
 */
export const unwrapSoleSection = (tr: Transaction): boolean => {
	const sections: { node: ProseMirrorNode; pos: number }[] = [];
	let pos = 0;
	for (const node of tr.doc.children) {
		if (isSection(node)) {
			sections.push({ node, pos });
		}
		pos += node.nodeSize;
	}
	const [sole] = sections;
	if (sections.length !== 1 || !sole) {
		return false;
	}
	tr.replaceWith(sole.pos, sole.pos + sole.node.nodeSize, sole.node.content);
	return true;
};

/**
 * Removes the boundary of the top-level section at `pos`: its text joins the
 * section before it, or the one after it when it is first. When one section would
 * remain, it is unwrapped into plain text too. A toast offers to undo it.
 */
export const mergeSection = (editor: Editor, pos: number): boolean => {
	const { doc } = editor.state;
	const node = doc.nodeAt(pos);
	if (!isSection(node)) {
		return false;
	}
	const index = doc.resolve(pos).index(0);
	const previous = index > 0 ? doc.child(index - 1) : null;
	const next = index < doc.childCount - 1 ? doc.child(index + 1) : null;
	const blocks = trimmedBlocks(node);
	const { tr } = editor.state;
	let message: string;
	// Where the two texts meet; the caret goes there, as after joining two paragraphs.
	let joinAt = pos;
	if (isSection(previous)) {
		const joined = [...trimmedBlocks(previous), ...blocks];
		tr.replaceWith(
			pos - previous.nodeSize,
			pos + node.nodeSize,
			previous.copy(Fragment.from(joined.length ? joined : previous.content)),
		);
		message = `„${sectionName(node)}“ in „${sectionName(previous)}“ übernommen`;
		joinAt = pos - previous.nodeSize + 1 + nodesSize(trimmedBlocks(previous));
	} else if (isSection(next)) {
		const joined = [...blocks, ...trimmedBlocks(next)];
		tr.replaceWith(
			pos,
			pos + node.nodeSize + next.nodeSize,
			next.copy(Fragment.from(joined.length ? joined : next.content)),
		);
		message = `„${sectionName(node)}“ in „${sectionName(next)}“ übernommen`;
		joinAt = pos + 1 + nodesSize(blocks);
	} else {
		tr.replaceWith(pos, pos + node.nodeSize, node.content);
		message = `Abschnitt „${sectionName(node)}“ aufgelöst`;
	}
	tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(joinAt, tr.doc.content.size))));
	if (unwrapSoleSection(tr)) {
		message = "Abschnitte aufgelöst: Die Vorlage hat wieder keine Abschnitte";
	}
	// Its own undo step: not grouped with the typing before or after it.
	editor.view.dispatch(closeHistory(tr.scrollIntoView()));
	editor.view.dispatch(closeHistory(editor.state.tr));
	editor.view.focus();
	toast(message, {
		action: { label: "Rückgängig", onClick: () => editor.chain().focus().undo().run() },
	});
	return true;
};
