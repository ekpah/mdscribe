/**
 * Converts Markdoc tags to HTML format that can be used with Tiptap
 * Supports info, switch, and case tags
 */

interface ParsedTag {
  type: string;
  attributes: Record<string, string>;
  content: string;
}

/**
 * Parse a single Markdoc tag into its components
 * Example: {% info "title" /%} -> { type: "info", attributes: { primary: "title" }, content: "" }
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
    return {
      type: openMatch[1],
      attributes: openMatch[2] ? { primary: openMatch[2] } : {},
      content: '',
    };
  }

  return null;
}

/**
 * Convert Markdoc format to HTML
 * @param markdoc - String in Markdoc format
 * @returns String in HTML format
 */
export function markdocToHTML(markdoc: string): string {
  // Handle switch/case blocks first
  const switchRegex = /{%\s*switch\s*%}([\s\S]*?){%\s*\/switch\s*%}/g;
  const caseRegex = /{%\s*case\s*"([^"]*)"\s*%}([\s\S]*?){%\s*\/case\s*%}/g;

  // Replace switch/case blocks
  const withSwitchCase = markdoc.replace(
    switchRegex,
    (match: string, content: string) => {
      const switchHtml = '<span data-type="markdoc-switch">';
      const cases = content.replace(
        caseRegex,
        (_: string, value: string, caseContent: string) => {
          return `<span data-type="markdoc-case" data-primary="${value}">${caseContent.trim()}</span>`;
        }
      );
      return `${switchHtml}${cases}</span>`;
    }
  );

  // Handle info tags
  const infoRegex = /{%\s*info\s*"([^"]*)"\s*\/?%}/g;
  const withInfo = withSwitchCase.replace(
    infoRegex,
    (_: string, value: string) => {
      return `<span data-type="markdoc-info" data-primary="${value}"></span>`;
    }
  );

  return withInfo;
}

/**
 * Convert HTML format back to Markdoc
 * @param html - String in HTML format
 * @returns String in Markdoc format
 */
export function htmlToMarkdoc(html: string): string {
  // Convert info tags
  const infoRegex =
    /<span data-type="markdoc-info" data-primary="([^"]*)"[^>]*><\/span>/g;
  const withInfo = html.replace(infoRegex, (_: string, value: string) => {
    return `{% info "${value}" /%}`;
  });

  // Convert switch/case blocks
  const switchRegex = /<span data-type="markdoc-switch">([\s\S]*?)<\/span>/g;
  const caseRegex =
    /<span data-type="markdoc-case" data-primary="([^"]*)">([\s\S]*?)<\/span>/g;

  const withSwitchCase = withInfo.replace(
    switchRegex,
    (_: string, content: string) => {
      const switchStart = '{% switch %}';
      const cases = content.replace(
        caseRegex,
        (_: string, value: string, caseContent: string) => {
          return `{% case "${value}" %}${caseContent.trim()}{% /case %}`;
        }
      );
      return `${switchStart}${cases}{% /switch %}`;
    }
  );

  return withSwitchCase;
}
