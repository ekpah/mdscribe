import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
// import renderItems from './markdocRenderItems.js';

export interface MarkdocTagAttrs {
  /**
   * The tag name for the Markdoc tag
   */
  tagName: string;

  /**
   * The attributes passed to the tag
   */
  attributes?: Record<string, string> | null;
}

export interface MarkdocTagItem {
  tagName: string;
  attributes?: Record<string, string>;
}

export const MarkdocTag = Node.create({
  name: 'markdocTag',

  // This is needed to ensure that the markdoc tag is rendered before the default nodes
  priority: 101,

  group: 'inline',

  inline: true,

  selectable: false,

  atom: true,

  addAttributes() {
    return {
      tagName: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tag-name'),
        renderHTML: (attributes) => {
          if (!attributes.tagName) {
            return {};
          }
          return {
            'data-tag-name': attributes.tagName,
          };
        },
      },
    };
  },
  renderText({ node }: { node: ProseMirrorNode }) {
    return `${node.attrs.tagName}`;
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-type="markdoc-case"]',
      },
      {
        tag: 'span[data-type="markdoc-switch"]',
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
      'span',
      mergeAttributes(
        { 'data-type': 'markdocTag' },
        { class: 'bg-blue-500 text-white px-2 py-1 rounded-md' },
        HTMLAttributes,
        {
          'data-tag-name': node.attrs.tagName,
          'data-attributes': node.attrs.attributes
            ? JSON.stringify(node.attrs.attributes)
            : null,
        }
      ),
      `${node.attrs.tagName}`,
    ] as [string, Record<string, string>, string];
  },

  // input rule to detect the markdoc tag
  addInputRules() {
    return [
      nodeInputRule({
        find: /{%\s*(.*?)\s*%}/g,
        type: this.type,
      }),
    ];
  },
});

export { MarkdocTag as default };
