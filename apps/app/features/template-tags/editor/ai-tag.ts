import { Mark, Node, markInputRule, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		aiTag: {
			/** Marks the selection as an instruction for the AI, or unmarks it. */
			toggleAiTag: () => ReturnType;
		};
	}
}

/**
 * Typed `((…))` becomes an instruction once its closing `))` is typed. Single
 * parentheses inside, like `(extern)`, stay part of it.
 */
const DOUBLE_PARENTHESES = /(?:^|\s)(\(\(((?:[^()]|\([^()]*\))+)\)\))$/u;

/**
 * An instruction for the AI, `{% ai %}…{% /ai %}`: shown muted, followed during
 * generation and never part of the finished text.
 */
export const AiTag = Mark.create({
	addCommands() {
		return {
			toggleAiTag:
				() =>
				({ commands }) =>
					commands.toggleMark(this.name),
		};
	},

	addInputRules() {
		return [markInputRule({ find: DOUBLE_PARENTHESES, type: this.type })];
	},

	name: "aiTag",

	parseHTML() {
		return [{ tag: "ai:not([block])" }];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"ai",
			mergeAttributes(HTMLAttributes, {
				class: "rounded-sm bg-solarized-magenta/10 px-0.5 text-muted-foreground italic",
				"data-markdoc-ai": "",
			}),
			0,
		];
	},
});

/**
 * A block instruction around whole paragraphs, written with the tags on their
 * own lines. Kept as one node, so its paragraphs stay one instruction.
 */
export const AiBlockTag = Node.create({
	content: "block+",
	defining: true,
	group: "block",

	name: "aiBlockTag",

	parseHTML() {
		return [{ tag: "ai[block]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"ai",
			mergeAttributes(HTMLAttributes, {
				block: "true",
				class: "block rounded-sm bg-solarized-magenta/10 px-1 text-muted-foreground italic",
				"data-markdoc-ai": "",
			}),
			0,
		];
	},
});
