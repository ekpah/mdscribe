import {
  Mark,
  markInputRule,
  markPasteRule,
  mergeAttributes,
} from '@tiptap/core';

export interface BracketHighlightOptions {
  /**
   * HTML attributes to add to the bracket highlight element.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, unknown>;
}

/**
 * Matches text within [] as input.
 * Pattern: [content]
 */
export const bracketInputRegex = /(\[(?!\s+\[)([^\]]+)\](?!\s+\]))$/;

/**
 * Matches text within [] while pasting.
 * Pattern: [content]
 */
export const bracketPasteRegex = /(\[(?!\s+\[)([^\]]+)\](?!\s+\]))/g;

/**
 * This extension highlights text within [] with a faint green background,
 * but preserves the brackets visibly, highlighting only the content within.
 * Useful for marking AI instruction variables.
 */
export const BracketHighlight = Mark.create<BracketHighlightOptions>({
  name: 'bracketHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-bracket-highlight]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Renders [<span ...>content</span>] in HTML
    // Make sure brackets are always present and not styled, only the content is.
    return [
      'span',
      { class: 'inline-flex items-center gap-0.5' },
      [
        'span',
        {
          'aria-hidden': 'true',
          class: 'text-solarized-green select-none',
        },
        '[',
      ],
      [
        'span',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          'data-bracket-highlight': '',
          class: 'bg-solarized-green/10 rounded px-0.5 ',
        }),
        0,
      ],
      [
        'span',
        {
          'aria-hidden': 'true',
          class: 'text-solarized-green select-none',
        },
        ']',
      ],
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: bracketInputRegex,
        type: this.type,
        getAttributes: () => ({}),
        /**
         * Replace the text with three nodes:
         * - left bracket
         * - mark containing only the content
         * - right bracket
         * Handled by renderHTML.
         */
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: bracketPasteRegex,
        type: this.type,
        getAttributes: () => ({}),
        // The actual splitting of brackets/content is rendered at HTML render/React
      }),
    ];
  },
});
