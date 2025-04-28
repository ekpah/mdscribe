/**
 * Converts Markdoc tags to HTML format using custom elements that can be used with Tiptap.
 * Supports info, switch, and case tags.
 */

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
 * Convert Markdoc format to HTML using custom elements.
 * @param markdoc - String in Markdoc format.
 * @returns String in HTML format with custom elements like <markdoc-info>, <markdoc-switch>, <markdoc-case>.
 */
export function markdocToHTML(markdoc: string): string {
  // Handle switch/case blocks first
  const switchRegex = /{%\s*switch\s*%}([\s\S]*?){%\s*\/switch\s*%}/g;
  const caseRegex = /{%\s*case\s*"([^"]*)"\s*%}([\s\S]*?){%\s*\/case\s*%}/g;

  // Replace switch/case blocks with <markdoc-switch> and <markdoc-case>
  const withSwitchCase = markdoc.replace(
    switchRegex,
    (match: string, content: string) => {
      const switchHtml = '<markdoc-switch>';
      const cases = content.replace(
        caseRegex,
        (_: string, value: string, caseContent: string) => {
          // Convert inner Markdoc case tags to <markdoc-case> elements
          return `<markdoc-case data-primary="${value}">${caseContent.trim()}</markdoc-case>`;
        }
      );
      return `${switchHtml}${cases}</markdoc-switch>`;
    }
  );

  // Handle self-closing info tags: {% info "value" /%}
  const infoRegex = /{%\s*info\s*"([^"]*)"\s*\/?%}/g;
  const withInfo = withSwitchCase.replace(
    infoRegex,
    (_: string, value: string) => {
      // Convert Markdoc info tags to <markdoc-info> elements
      return `<markdoc-info data-primary="${value}"></markdoc-info>`;
    }
  );

  // TODO: Add handling for other Markdoc tags as needed (e.g., variable tags)

  return withInfo;
}

/**
 * Convert HTML format with custom elements back to Markdoc.
 * @param html - String in HTML format using custom elements like <markdoc-info>, <markdoc-switch>, <markdoc-case>.
 * @returns String in Markdoc format.
 */
export function htmlToMarkdoc(html: string): string {
  // Convert <markdoc-info> elements back to Markdoc info tags first
  // Handles <markdoc-info data-primary="value"></markdoc-info>
  const infoRegex =
    /<markdoc-info data-primary="([^"]*)"[^>]*><\/markdoc-info>/g;
  const withInfo = html.replace(infoRegex, (_: string, value: string) => {
    return `{% info "${value}" /%}`;
  });

  // Convert <markdoc-switch> and nested <markdoc-case> elements back to Markdoc switch/case blocks
  const switchRegex =
    /<markdoc-switch data-primary="([^"]*)">([\s\S]*?)<\/markdoc-switch>/g;
  const caseRegex =
    /<markdoc-case data-primary="([^"]*)">([\s\S]*?)<\/markdoc-case>/g;

  const withSwitchCase = withInfo.replace(
    switchRegex,
    (_: string, primary: string, content: string) => {
      // Start the Markdoc switch block
      const switchStart = `{% switch ${primary ? `"${primary}"` : '""'} %}`;

      // Convert nested <markdoc-case> elements back to Markdoc case blocks
      const cases = content.replace(
        caseRegex,
        (_caseMatch: string, value: string, caseContent: string) => {
          // Trim potential whitespace around case content from HTML parsing
          return `{% case "${value}" %}${caseContent.trim()}{% /case %}`;
        }
      );

      // Close the Markdoc switch block
      const switchEnd = '{% /switch %}';

      // Combine the parts to form the final Markdoc switch block
      return `${switchStart}${cases}${switchEnd}`;
    }
  );

  // TODO: Add handling for converting other custom HTML elements back to Markdoc as needed

  return withSwitchCase;
}
