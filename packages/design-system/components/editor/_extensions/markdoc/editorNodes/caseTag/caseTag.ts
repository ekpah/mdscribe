import { Node, mergeAttributes } from '@tiptap/core';
import { ProseMirrorNode, ReactNodeViewRenderer } from '@tiptap/react';
import { CaseTagView } from './CaseTagView';
export interface CaseTagOptions {
  HTMLAttributes: Record<string, any>;
}

/**
 * Represents a case within a switch statement in Markdoc.
 * {% case "value" %}
 * Content for this case
 * {% /case %}
 */
export const CaseTag = Node.create<CaseTagOptions>({
  name: 'caseTag',
  group: 'inline',
    inline: true,
  content: 'inline*',
  atom: false,
  addAttributes() {
    return {
      primary: {
        default: "",
        parseHTML: (element) => element.getAttribute('primary'),
        renderHTML: (attributes) => ({
          primary: attributes.primary,
        }),
      },
    };
  },
  renderText({ node }: { node: ProseMirrorNode }) {
    const casePrimary = node.attrs.primary;
    const casePrimaryValue = casePrimary ? JSON.stringify(casePrimary) : '""';
    const caseContent = node.textContent;
    return `{% case ${casePrimaryValue} %}${caseContent}{% /case %}`;
  },
  renderHTML({
    HTMLAttributes,
    node,
  }: { HTMLAttributes: Record<string, string>; node: ProseMirrorNode }) {
    return [
      'markdoc-case',
      mergeAttributes(HTMLAttributes, {
        primary: node.attrs.primary,
      }),
      0,
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'markdoc-case',
      },
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CaseTagView);
  },
});

export default CaseTag;
