import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface CaseTagAttrs {
  primary: string | null;
}

export const CaseTag = Node.create<CaseTagAttrs>({
  name: 'caseTag',
  group: 'inline',
  inline: true,
  content: 'inline*',
  atom: false,
  addAttributes() {
    return {
      primary: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-primary'),
        renderHTML: (attributes) => ({
          'data-primary': attributes.primary,
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
        'data-primary': node.attrs.primary,
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
});

export default CaseTag;
