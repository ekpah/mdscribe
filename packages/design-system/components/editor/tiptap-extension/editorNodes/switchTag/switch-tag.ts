import { Node, mergeAttributes } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer } from '@tiptap/react';
// Renamed import
import { SwitchTagView } from './switch-tag-view';

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
  // Keep for consistency for now, might remove later
  variable: string | null;
}

export const SwitchTag = Node.create<SwitchTagAttrs>({
  addAttributes() {
    return {
      cases: {
        default: [],
        renderHTML: () => ({}),
      },
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
    return ReactNodeViewRenderer(SwitchTagView);
  },
  atom: true,
  draggable: false,
  group: 'inline',
  inline: true,
  isolating: true,

  name: 'switchTag',

  parseHTML() {
    return [
      {
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {return false;}
          const primary = element.getAttribute('primary');
          const caseElements = [...element.children].filter(
            (child) => child.tagName.toLowerCase() === 'case'
          );
          const cases = caseElements.map((child) => ({
            primary: child.getAttribute('primary') ?? '',
            text: (child.textContent ?? '').trim(),
          }));

          return {
            cases,
            primary,
          };
        },
        getContent: () => Fragment.empty,
        tag: 'Switch',
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

  selectable: true,
});
