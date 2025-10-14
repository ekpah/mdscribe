import { Mark, mergeAttributes } from '@tiptap/core';

export interface BracketHighlightOptions {
  HTMLAttributes: Record<string, unknown>;
}

/**
 * Mark for highlighting text within [] with a faint green background
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
});
