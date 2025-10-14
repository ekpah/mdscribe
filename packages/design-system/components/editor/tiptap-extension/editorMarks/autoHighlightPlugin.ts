import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface AutoHighlightOptions {
  types: string[];
}

/**
 * Plugin that automatically highlights (()) and [] patterns in the editor
 */
export const AutoHighlight = Extension.create<AutoHighlightOptions>({
  name: 'autoHighlight',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'listItem', 'blockquote'],
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('autoHighlight'),
        
        state: {
          init: (_, { doc }) => {
            return findHighlights(doc);
          },
          apply: (transaction, oldState) => {
            if (!transaction.docChanged) {
              return oldState;
            }
            return findHighlights(transaction.doc);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function findHighlights(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) {
      return;
    }

    const text = node.text || '';
    
    // Find (()) patterns
    const doubleParenRegex = /\(\([^)]*\)\)/g;
    let match;
    
    while ((match = doubleParenRegex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      
      decorations.push(
        Decoration.inline(from, to, {
          class: 'bg-solarized-blue/10 rounded px-0.5',
          'data-double-paren-highlight': '',
        })
      );
    }

    // Find [] patterns
    const bracketRegex = /\[[^\]]*\]/g;
    
    while ((match = bracketRegex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      
      decorations.push(
        Decoration.inline(from, to, {
          class: 'bg-solarized-green/10 rounded px-0.5',
          'data-bracket-highlight': '',
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
