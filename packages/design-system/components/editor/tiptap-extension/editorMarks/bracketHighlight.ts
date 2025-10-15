import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core';

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
 * This extension highlights text within [] with a faint green background.
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
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-bracket-highlight': '',
        class: 'bg-solarized-green/10 rounded px-0.5',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setBracketHighlight:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },
      toggleBracketHighlight:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
      unsetBracketHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addInputRules() {
    return [
      markInputRule({
        find: bracketInputRegex,
        type: this.type,
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: bracketPasteRegex,
        type: this.type,
      }),
    ];
  },
});
