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
    return node.textContent || '';
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    // Recursively process children *first* to get their Markdoc/HTML representation
    let innerContent = '';
    for (const child of element.childNodes) {
      innerContent += processNodeForMarkdoc(child);
    }

    switch (tagName) {
      case 'info': {
        const infoPrimary = element.getAttribute('primary') || '';
        // Assuming info is always self-closing based on your markdocToHTML config
        return `{% info "${infoPrimary}" /%}`;
      }

      case 'switch': {
        // This attribute is rendered as 'data-primary' by Markdoc
        const switchPrimary = element.getAttribute('primary') || '';
        // innerContent already contains the processed children (case tags)
        return `{% switch ${switchPrimary ? `"${switchPrimary}"` : '""'} %}${innerContent}{% /switch %}`;
      }

      case 'case': {
        // This attribute is rendered as 'data-primary' by Markdoc
        const casePrimary = element.getAttribute('primary') || '';
        // Trim whitespace that might be introduced during HTML parsing/processing
        return `{% case "${casePrimary}" %}${innerContent.trim()}{% /case %}`;
      }

      default:
        // Fallback for unknown tags: Keep them as HTML for now.
        // Consider logging or handling differently based on requirements.
        // console.warn(
        //   `Unhandled HTML tag during Markdoc conversion: ${tagName}`
        // );
        // Reconstruct the original tag, simple version (attributes ignored for brevity)
        // Return only the content for unknown tags to avoid including potentially unwanted HTML.
        // Alternatively, reconstruct the element: return element.outerHTML;
        return innerContent;
    }
  }

  return ''; // Ignore comments, other node types
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
  if (typeof window === 'undefined' || !window.DOMParser) {
    console.error(
      'DOMParser is not available. Cannot convert HTML to Markdoc.'
    );
    // Fallback or throw error depending on desired behavior in non-browser env
    return html; // Return original HTML as a basic fallback
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Start processing from the body to skip implicit <html><head><body> tags
  // and handle potentially fragmented HTML inputs correctly.
  return processNodeForMarkdoc(doc.body);
}
