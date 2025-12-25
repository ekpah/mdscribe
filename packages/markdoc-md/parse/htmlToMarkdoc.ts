/**
 * Converts Markdoc tags to HTML format using custom elements that can be used with Tiptap.
 * Supports info, switch, and case tags.
 */

/**
 * Recursively processes a DOM node to convert custom Markdoc elements
 * and potentially standard HTML back into Markdoc or HTML string format.
 * This function is designed for client-side (browser) execution.
 * @param node - The DOM node to process.
 * @returns The Markdoc or HTML string representation of the node.
 */
function processNodeForMarkdoc(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent || "";
	}

	if (node.nodeType === Node.ELEMENT_NODE) {
		const element = node as Element;
		const tagName = element.tagName.toLowerCase();

		// Recursively process children *first* to get their Markdoc/HTML representation
		let innerContent = "";
		for (const child of element.childNodes) {
			innerContent += processNodeForMarkdoc(child);
		}

		switch (tagName) {
			// Custom Markdoc tags
			case "info": {
				const infoPrimary = element.getAttribute("primary") || "";
				// Assuming info is always self-closing
				return `{% info "${infoPrimary}" /%}`;
			}

			case "score": {
				const formula = element.getAttribute("formula") || "";
				const unit = element.getAttribute("unit") || "";
				const unitAttr = unit ? ` unit="${unit}"` : "";
				return `{% score formula="${formula}"${unitAttr} /%}`;
			}

			case "switch": {
				// This attribute is rendered as 'data-primary' by Markdoc
				const switchPrimary = element.getAttribute("primary") || "";
				// innerContent already contains the processed children (case tags)
				return `{% switch ${switchPrimary ? `"${switchPrimary}"` : '""'} %}${innerContent}{% /switch %}`;
			}

			case "case": {
				// This attribute is rendered as 'data-primary' by Markdoc
				const casePrimary = element.getAttribute("primary") || "";
				// Trim whitespace that might be introduced during HTML parsing/processing
				return `{% case "${casePrimary}" %}${innerContent.trim()}{% /case %}`;
			}

			// HTML block elements - preserve structure with line breaks
			case "p": {
				return `${innerContent}\n\n`;
			}

			case "br": {
				return "\n";
			}

			case "h1": {
				return `# ${innerContent}\n\n`;
			}

			case "h2": {
				return `## ${innerContent}\n\n`;
			}

			case "h3": {
				return `### ${innerContent}\n\n`;
			}

			case "h4": {
				return `#### ${innerContent}\n\n`;
			}

			case "h5": {
				return `##### ${innerContent}\n\n`;
			}

			case "h6": {
				return `###### ${innerContent}\n\n`;
			}

			case "ul": {
				return `${innerContent}\n`;
			}

			case "ol": {
				return `${innerContent}\n`;
			}

			case "li": {
				// Check if parent is ol or ul
				const parent = element.parentElement;
				if (parent?.tagName.toLowerCase() === "ol") {
					// For ordered lists, we'd need to track the index
					// For simplicity, use "1." which markdown renderers auto-number
					return `1. ${innerContent.trim()}\n`;
				}
				return `- ${innerContent.trim()}\n`;
			}

			case "blockquote": {
				// Prefix each line with >
				const lines = innerContent.trim().split("\n");
				return lines.map((line) => `> ${line}`).join("\n") + "\n\n";
			}

			case "pre": {
				return `\`\`\`\n${innerContent}\n\`\`\`\n\n`;
			}

			case "code": {
				// Check if inside a pre tag (code block) or inline
				const parent = element.parentElement;
				if (parent?.tagName.toLowerCase() === "pre") {
					return innerContent;
				}
				return `\`${innerContent}\``;
			}

			// Inline formatting
			case "strong":
			case "b": {
				return `**${innerContent}**`;
			}

			case "em":
			case "i": {
				return `*${innerContent}*`;
			}

			case "a": {
				const href = element.getAttribute("href") || "";
				return `[${innerContent}](${href})`;
			}

			case "hr": {
				return "\n---\n\n";
			}

			// Container elements that should just pass through content
			case "div":
			case "span":
			case "body":
			case "html": {
				return innerContent;
			}

			default:
				// Fallback for unknown tags: just return content
				return innerContent;
		}
	}

	return ""; // Ignore comments, other node types
}

/**
 * Convert HTML containing custom Markdoc elements (<markdoc-*>) back to Markdoc syntax.
 * Uses the browser's DOMParser for robust HTML parsing. This function is
 * intended for client-side execution.
 *
 * @param html - String in HTML format, potentially containing <markdoc-info>,
 *               <markdoc-switch>, <markdoc-case>, and standard HTML elements.
 * @returns String in Markdoc format mixed with any preserved HTML.
 */
export function htmlToMarkdoc(html: string): string {
	if (typeof window === "undefined" || !window.DOMParser) {
		console.error(
			"DOMParser is not available. Cannot convert HTML to Markdoc.",
		);
		// Fallback or throw error depending on desired behavior in non-browser env
		return html; // Return original HTML as a basic fallback
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Start processing from the body to skip implicit <html><head><body> tags
	// and handle potentially fragmented HTML inputs correctly.
	return processNodeForMarkdoc(doc.body);
}
