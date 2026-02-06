import { Node, mergeAttributes } from '@tiptap/core';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SwitchTagView } from './switchTagView'; // Renamed import

export interface SwitchCase {
  primary: string;
  text: string;
}

export interface SwitchTagAttrs {
  /**
   * The primary text value for the switch tag (e.g., the variable to switch on)
   */
  primary: string | null;
  /**
   * Cases to render within the switch tag
   */
  cases: SwitchCase[];
  /**
   * Optional variable name for dynamic content (might not be needed for switch)
   */
  variable: string | null; // Keep for consistency for now, might remove later
}

export const SwitchTag = Node.create<SwitchTagAttrs>({
  name: 'switchTag',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
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
      cases: {
        default: [],
        renderHTML: () => ({}),
      },
    };
  },

  renderText({ node }: { node: ProseMirrorNode }) {
    const switchPrimary = node.attrs.primary;
    const switchPrimaryValue = switchPrimary
      ? JSON.stringify(switchPrimary)
      : '""';
    const cases: SwitchCase[] = Array.isArray(node.attrs.cases)
      ? node.attrs.cases
      : [];
    const content = cases
      .map((caseItem) => {
        const casePrimaryValue = caseItem.primary
          ? JSON.stringify(caseItem.primary)
          : '""';
        const caseText = caseItem.text ?? '';
        return `{% case ${casePrimaryValue} %}${caseText}{% /case %}`;
      })
      .join('');

    return `{% switch ${switchPrimaryValue} %}${content}{% /switch %}`;
  },

  renderHTML({
    HTMLAttributes,
    node,
  }: {
    HTMLAttributes: Record<string, string>;
    node: ProseMirrorNode;
  }) {
    const cases: SwitchCase[] = Array.isArray(node.attrs.cases)
      ? node.attrs.cases
      : [];
    const caseNodes = cases.map((caseItem) => [
      'Case',
      { primary: caseItem.primary ?? '' },
      caseItem.text ?? '',
    ]);

    return [
      'Switch',
      mergeAttributes(HTMLAttributes, {
        primary: node.attrs.primary,
      }),
      ...caseNodes,
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'Switch',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const primary = element.getAttribute('primary');
          const caseElements = Array.from(element.children).filter(
            (child) => child.tagName.toLowerCase() === 'case'
          );
          const cases = caseElements.map((child) => ({
            primary: child.getAttribute('primary') ?? '',
            text: (child.textContent ?? '').trim(),
          }));

          return {
            primary,
            cases,
          };
        },
        getContent: () => Fragment.empty,
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SwitchTagView);
  },
});
