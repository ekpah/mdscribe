import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ScoreTagView } from './score-tag-view';

export interface ScoreTagAttrs {
  /**
   * The formula to calculate the score
   */
  formula: string | null;
  /**
   * Optional unit for the calculated value
   */
  unit: string | null;
}

export const ScoreTag = Node.create<ScoreTagAttrs>({
  addAttributes() {
    return {
      formula: {
        default: null,
        parseHTML: (element) => element.getAttribute('formula'),
        renderHTML: (attributes) => ({
          formula: attributes.formula,
        }),
      },
      unit: {
        default: null,
        parseHTML: (element) => element.getAttribute('unit'),
        renderHTML: (attributes) => ({
          unit: attributes.unit,
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScoreTagView);
  },
  atom: true,
  draggable: false,
  group: 'inline',
  inline: true,

  name: 'scoreTag',

  parseHTML() {
    return [
      {
        tag: 'Score',
      },
    ];
  },

  renderHTML({
    HTMLAttributes,
    node,
  }: {
    HTMLAttributes: Record<string, string>;
    node: ProseMirrorNode;
  }) {
    return [
      'Score',
      mergeAttributes(HTMLAttributes, {
        formula: node.attrs.formula,
        unit: node.attrs.unit,
      }),
    ];
  },
  
  renderText({ node }: { node: ProseMirrorNode }) {
    const formula = node.attrs.formula || '';
    const unit = node.attrs.unit ? ` unit="${node.attrs.unit}"` : '';
    return `{% score formula="${formula}"${unit} /%}`;
  },

  selectable: true,
});
