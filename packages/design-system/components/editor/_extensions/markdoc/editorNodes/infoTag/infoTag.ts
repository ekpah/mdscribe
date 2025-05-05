import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { InfoTagView } from './InfoTagView';

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

// TODO: Review if this interface is needed for InfoTag
export interface InfoTagItem {
  tagName: string;
  attributes?: Record<string, string>;
}

export const InfoTag = Node.create<InfoTagAttrs>({
  name: 'infoTag',

  group: 'inline',

  // Make the node draggable
  draggable: true,
  inline: true,

  atom: true,

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

  renderText({ node }: { node: ProseMirrorNode }) {
    return `{% info "${node.attrs.primary}" /%}`;
  },

  renderHTML({
    HTMLAttributes,
    node,
  }: {
    HTMLAttributes: Record<string, string>;
    node: ProseMirrorNode;
  }) {
    return [
      'markdoc-info',
      mergeAttributes(HTMLAttributes, {
        primary: node.attrs.primary,
      }),
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'markdoc-info',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InfoTagView);
  },
});

export default InfoTag;
