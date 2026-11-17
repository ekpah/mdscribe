import type { ReactNode } from "react";

/**
 * An instruction for the AI, such as how to phrase a paragraph. Shown muted and
 * never part of the finished text: generation follows it, and copying drops
 * every `data-markdoc-ai` element. Inline styles keep it muted in rich copies too.
 */
const Ai = ({ block = false, children }: { block?: boolean; children?: ReactNode }) => {
	const Element = block ? "div" : "span";
	return (
		<Element data-markdoc-ai="" style={{ color: "#888", fontStyle: "italic" }}>
			{children}
		</Element>
	);
};

/**
 * One titled part of a letter, shown as a card with a header strip. The card is
 * drawn with classes, which copied rich text drops, so a copied letter keeps only
 * the title as a bold line above its text.
 */
const Section = ({ children, id, title }: { children?: ReactNode; id: string; title?: string }) => (
	<section
		className="overflow-hidden rounded-md border"
		data-markdoc-section=""
		data-section-id={id}
		style={{ margin: "0 0 1.45em" }}
	>
		<div
			className="border-b bg-muted/40 px-3 py-1.5"
			data-template-line=""
			style={{ fontWeight: 600 }}
		>
			{title?.trim() || id}
		</div>
		<div className="px-3 py-2">{children}</div>
	</section>
);

/** React components for the app's template tags, by render name. */
export const templateTagComponents = { Ai, Section };
