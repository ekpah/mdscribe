import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SwitchTagView } from './switchTagView'; // Renamed import

export interface SwitchTagAttrs {
  /**
   * The primary text value for the switch tag (e.g., the variable to switch on)
   */
  primary: string | null;
  /**
   * Optional variable name for dynamic content (might not be needed for switch)
   */
  variable: string | null; // Keep for consistency for now, might remove later
}

export const SwitchTag = Node.create<SwitchTagAttrs>({
  name: 'switchTag',

  group: 'inline',
  content: 'inline*',
  inline: true,
  selectable: true,
  draggable: true,
  atom: true,
  isolating: true,

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
    const switchPrimary = node.attrs.primary;
    const switchPrimaryValue = switchPrimary
      ? JSON.stringify(switchPrimary)
      : '""';
    let content = '';

    // Iterate through child nodes (caseTags)
    for (const child of node.children) {
      // child.textContent recursively calls renderText on children.
      // caseTag.renderText already includes the {% case %} tags.
      content += child.textContent;
    }
    return `{% switch ${switchPrimaryValue} %}${content}{% /switch %}`;
  },

  renderHTML({
    HTMLAttributes,
    node,
  }: {
    HTMLAttributes: Record<string, string>;
    node: ProseMirrorNode;
  }) {
    return [
      'Switch',
      mergeAttributes(HTMLAttributes, {
        primary: node.attrs.primary,
      }),
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'Switch',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SwitchTagView);
  },
});

export default SwitchTag;
