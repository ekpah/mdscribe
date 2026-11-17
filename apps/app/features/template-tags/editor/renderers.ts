import type { HtmlToMarkdocRenderer } from "markdoc-md/editor";

const quote = (value: string) => JSON.stringify(value);

/** Writes the editor elements of the app's tags back to Markdoc. */
export const templateTagRenderers: Record<string, HtmlToMarkdocRenderer> = {
	// Block form keeps its tags on their own lines, so its paragraphs stay one instruction.
	ai: (element, innerContent) =>
		element.hasAttribute("block")
			? `{% ai %}\n${innerContent}{% /ai %}\n\n`
			: `{% ai %}${innerContent}{% /ai %}`,
	section: (element, innerContent) => {
		const title = element.getAttribute("title");
		const titleAttribute = title ? ` title=${quote(title)}` : "";
		return `{% section id=${quote(element.getAttribute("id") ?? "")}${titleAttribute} %}\n${innerContent}{% /section %}\n\n`;
	},
};
