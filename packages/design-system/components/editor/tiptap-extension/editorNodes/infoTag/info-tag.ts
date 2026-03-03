import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { InfoTagView } from './info-tag-view';

// TODO: Refactor attributes to match InfoTagMenu (primary, variable)
// The current attributes (tagName) seem incorrect for InfoTag.
export interface InfoTagAttrs {
  /**
   * The primary text value for the info tag
   */
  primary: string | null;
  /**
   * Optional variable name for dynamic content
   */
  variable: string | null;
}

export const InfoTag = Node.create<InfoTagAttrs>({
  addAttributes() {
    return {
      primary: {
        default: null,
        parseHTML: (element) => element.getAttribute('primary'),
        renderHTML: (attributes) => ({
          primary: attributes.primary,
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(InfoTagView);
  },

  atom: true,
  draggable: false,
  group: 'inline',
  inline: true,
  isolating: true,

  name: 'infoTag',

  parseHTML() {
    return [
      {
        tag: 'Info',
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
      'Info',
      mergeAttributes(HTMLAttributes, {
        primary: node.attrs.primary,
      }),
    ];
  },
  renderText({ node }: { node: ProseMirrorNode }) {
    return `{% info "${node.attrs.primary}" /%}`;
  },

  selectable: true,
});
