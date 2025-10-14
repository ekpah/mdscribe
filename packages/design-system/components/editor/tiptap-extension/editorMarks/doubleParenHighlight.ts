import { Mark, mergeAttributes } from '@tiptap/core';

export interface DoubleParenHighlightOptions {
  HTMLAttributes: Record<string, unknown>;
}

/**
 * Mark for highlighting text within (()) with a faint blue background
 */
export const DoubleParenHighlight = Mark.create<DoubleParenHighlightOptions>({
  name: 'doubleParenHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-double-paren-highlight]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-double-paren-highlight': '',
        class: 'bg-solarized-blue/10 rounded px-0.5',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setDoubleParenHighlight:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },
      toggleDoubleParenHighlight:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
      unsetDoubleParenHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
