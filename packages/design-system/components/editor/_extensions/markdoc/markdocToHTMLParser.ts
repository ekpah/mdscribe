/**
 * Converts Markdoc tags to HTML format using custom elements that can be used with Tiptap.
 * Supports info, switch, and case tags.
 */

import type { Config } from '@markdoc/markdoc';
import Markdoc from '@markdoc/markdoc';

interface ParsedTag {
  type: string;
  attributes: Record<string, string>;
  content: string;
}

/**
 * Parse a single Markdoc tag into its components.
 * Example: {% info "title" /%} -> { type: "info", attributes: { primary: "title" }, content: "" }
 * Note: This function is currently unused but kept for potential future use or reference.
 */
function parseMarkdocTag(tag: string): ParsedTag | null {
  // Match {% tagName "attribute" /%} or {% tagName %}...{% /tagName %}
  const singleTagRegex = /^{%\s*(\w+)\s*(?:"([^"]*)")?\s*\/?%}$/;
  const openTagRegex = /^{%\s*(\w+)\s*(?:"([^"]*)")?\s*%}$/;
  const closeTagRegex = /^{%\s*\/(\w+)\s*%}$/;

  const singleMatch = tag.match(singleTagRegex);
  if (singleMatch) {
    return {
      type: singleMatch[1],
      attributes: singleMatch[2] ? { primary: singleMatch[2] } : {},
      content: '',
    };
  }

  const openMatch = tag.match(openTagRegex);
  if (openMatch) {
    // For opening tags, content is handled separately
    return {
      type: openMatch[1],
      attributes: openMatch[2] ? { primary: openMatch[2] } : {},
      content: '', // Content is between open and close tags
    };
  }

  // Note: Closing tags are handled by the block parsing logic (e.g., switch/case)

  return null;
}

/**
 * Convert Markdoc format to HTML suitable for Tiptap parsing.
 * Uses @markdoc/markdoc for AST-based parsing and transformation.
 * Renders custom tags into HTML elements with data attributes for Tiptap.
 * @param markdocString - String in Markdoc format.
 * @returns String in HTML format with custom elements like <span data-markdoc-tag="info">.
 */
export function markdocToHTML(markdocString: string): string {
  const ast = Markdoc.parse(markdocString);

  // Define how Markdoc tags and nodes should be transformed into HTML
  // suitable for Tiptap's parseHTML function.
  const config: Config = {
    tags: {
      info: {
        render: 'markdoc-info',
        attributes: {
          primary: {
            type: String,
          },
        },
        selfClosing: true,
      },
      switch: {
        render: 'markdoc-switch',
        children: ['tag', 'softbreak', 'markdoc-case', 'paragraph'],
        attributes: { primary: { render: true } },
      },
      case: {
        render: 'markdoc-case',
        attributes: { primary: { type: String } },
      },
    },
  };

  // Validate the AST before transforming
  const errors = Markdoc.validate(ast, config);
  if (errors.length) {
    console.error('Markdoc validation errors:', errors);
    // Optionally, return an error state or fallback HTML
    return '<p>Error processing Markdoc content.</p>';
  }

  // Transform the AST into a renderable tree using the config
  const content = Markdoc.transform(ast, config);

  // Render the content tree to HTML
  const html = Markdoc.renderers.html(content);

  return html;
}

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
      case 'markdoc-info': {
        const infoPrimary = element.getAttribute('primary') || '';
        // Assuming info is always self-closing based on your markdocToHTML config
        return `{% info "${infoPrimary}" /%}`;
      }

      case 'markdoc-switch': {
        // This attribute is rendered as 'data-primary' by Markdoc
        const switchPrimary = element.getAttribute('primary') || '';
        // innerContent already contains the processed children (case tags)
        return `{% switch ${switchPrimary ? `"${switchPrimary}"` : '""'} %}${innerContent}{% /switch %}`;
      }

      case 'markdoc-case': {
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
