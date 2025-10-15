import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core';

export interface DoubleParenHighlightOptions {
  /**
   * HTML attributes to add to the double paren highlight element.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, unknown>;
}

/**
 * Matches text within (()) as input.
 * Pattern: ((content))
 */
export const doubleParenInputRegex = /(\(\((?!\s+\(\()([^)]+)\)\)(?!\s+\)\)))$/;

/**
 * Matches text within (()) while pasting.
 * Pattern: ((content))
 */
export const doubleParenPasteRegex = /(\(\((?!\s+\(\()([^)]+)\)\)(?!\s+\)\)))/g;

/**
 * This extension highlights text within (()) with a faint blue background.
 * Useful for marking AI instruction placeholders.
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

  addInputRules() {
    return [
      markInputRule({
        find: doubleParenInputRegex,
        type: this.type,
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: doubleParenPasteRegex,
        type: this.type,
      }),
    ];
  },
});
