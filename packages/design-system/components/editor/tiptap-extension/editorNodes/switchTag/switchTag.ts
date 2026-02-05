import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
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
  content: 'caseTag+',
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
      0, // Render children (case tags) here
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

  addKeyboardShortcuts() {
    const isSwitchTag = (node?: ProseMirrorNode | null) =>
      node?.type.name === this.name;

    const deleteNodeAt = (from: number, to: number) => {
      this.editor.view.dispatch(this.editor.state.tr.delete(from, to));
      return true;
    };

    const moveCursorTo = (pos: number) =>
      this.editor.commands.setTextSelection(pos);

    return {
      Backspace: () => {
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const nodeBefore = $from.nodeBefore;
        if (!isSwitchTag(nodeBefore)) return false;
        return deleteNodeAt($from.pos - nodeBefore.nodeSize, $from.pos);
      },
      Delete: () => {
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const nodeAfter = $from.nodeAfter;
        if (!isSwitchTag(nodeAfter)) return false;
        return deleteNodeAt($from.pos, $from.pos + nodeAfter.nodeSize);
      },
      ArrowLeft: () => {
        const { selection } = this.editor.state;
        if (selection instanceof NodeSelection) {
          if (selection.node.type.name !== this.name) return false;
          return moveCursorTo(selection.from);
        }
        if (!selection.empty) return false;
        const { $from } = selection;
        const nodeBefore = $from.nodeBefore;
        if (!isSwitchTag(nodeBefore)) return false;
        return moveCursorTo($from.pos - nodeBefore.nodeSize);
      },
      ArrowRight: () => {
        const { selection } = this.editor.state;
        if (selection instanceof NodeSelection) {
          if (selection.node.type.name !== this.name) return false;
          return moveCursorTo(selection.to);
        }
        if (!selection.empty) return false;
        const { $from } = selection;
        const nodeAfter = $from.nodeAfter;
        if (!isSwitchTag(nodeAfter)) return false;
        return moveCursorTo($from.pos + nodeAfter.nodeSize);
      },
    };
  },
});
