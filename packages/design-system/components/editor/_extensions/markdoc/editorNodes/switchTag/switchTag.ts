import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SwitchTagView } from './switchTagView'; // Renamed import

// TODO: Refactor attributes to match SwitchTagMenu (primary, variable)
// The current attributes (tagName) seem incorrect for SwitchTag.
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

  // Make the node draggable
  draggable: true,

  content: 'inline*', // Expects one or more inline elements (like caseTag)

  atom: true,

  addStorage() {
    return {
      primary: this.options.primary,

      cases: [
        {
          case: '',
          value: '',
        },
      ],
    };
  },

  renderText({ node }: { node: ProseMirrorNode }) {
    const primary = node.attrs.primary || '""';
    const switchPrimary = node.attrs.primary;
    // Use JSON.stringify to handle quotes and escaping correctly for the primary value
    const switchPrimaryValue = switchPrimary
      ? JSON.stringify(switchPrimary)
      : '""';

    const caseStrings: string[] = [];
    for (const childNode of node.children) {
      // Only process direct children that are caseTag nodes
      if (childNode.type.name === 'caseTag') {
        const casePrimary = childNode.attrs.primary;
        // Use JSON.stringify for the case primary value as well
        const casePrimaryValue = casePrimary
          ? JSON.stringify(casePrimary)
          : '""';
        // Get the text content *within* the case node
        const caseContent = childNode.textContent;
        caseStrings.push(
          `{% case ${casePrimaryValue} %}${caseContent}{% /case %}`
        );
      }
      // Note: Other inline content within the switch but outside a case is ignored
      // in this Markdoc text representation, as it's not standard Markdoc syntax.
    }

    const contentString = caseStrings.join('\n'); // Join case tags with newlines

    // Ensure there's always content (at least a newline) between switch tags for structure
    const formattedContent = contentString ? `\n${contentString}\n` : '\n';

    return `{% switch ${switchPrimaryValue} %}${formattedContent}{% /switch %}`;
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
      mergeAttributes({ 'data-type': 'markdoc-switch' }, HTMLAttributes, {
        'data-primary': node.attrs.primary,
      }),
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-type="markdoc-switch"]',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SwitchTagView);
  },
});

export default SwitchTag;
