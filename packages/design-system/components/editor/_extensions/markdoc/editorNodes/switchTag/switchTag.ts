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
  name: 'switchTag', // Renamed node name

  group: 'inline',
  inline: true,

  // Make the node draggable and selectable
  draggable: true,
  selectable: true,
  isolating: true,

  content: 'inline*', // Expects one or more inline elements (like caseTag)

  atom: true,
  whitespace: 'pre',

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
      content += child.content;
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
      'markdoc-switch',
      mergeAttributes(HTMLAttributes, {
        primary: node.attrs.primary,
      }),
      0, // Add placeholder for child content rendering
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'markdoc-switch',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SwitchTagView);
  },
});

export default SwitchTag;
