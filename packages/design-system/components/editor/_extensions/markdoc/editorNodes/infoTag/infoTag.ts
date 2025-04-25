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
        parseHTML: (element) => element.getAttribute('data-primary'),
        renderHTML: (attributes) => ({
          'data-primary': attributes.primary,
        }),
      },
      variable: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-variable'),
        renderHTML: (attributes) => ({
          'data-variable': attributes.variable,
        }),
      },
    };
  },

  renderText({ node }: { node: ProseMirrorNode }) {
    const primary = node.attrs.primary || '""';
    return `{% info "${primary}" /%}`;
  },

  renderHTML({
    HTMLAttributes,
    node,
  }: {
    HTMLAttributes: Record<string, string>;
    node: ProseMirrorNode;
  }) {
    return [
      'span',
      mergeAttributes({ 'data-type': 'markdoc-info' }, HTMLAttributes, {
        'data-primary': node.attrs.primary,
        'data-variable': node.attrs.variable,
      }),
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-type="markdoc-info"]',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InfoTagView);
  },
});

export default InfoTag;
