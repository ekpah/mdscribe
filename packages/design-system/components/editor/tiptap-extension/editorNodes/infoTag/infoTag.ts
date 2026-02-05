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
interface InfoTagItem {
  tagName: string;
  attributes?: Record<string, string>;
}

export const InfoTag = Node.create<InfoTagAttrs>({
  name: 'infoTag',

  selectable: true,

  group: 'inline',
  content: 'inline*',
  inline: true,
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
    return `{% info "${node.attrs.primary}" /%}`;
  },

  renderHTML({
    HTMLAttributes,
    node,
  }: {
    HTMLAttributes: Record<string, string>;
    node: ProseMirrorNode;
  }) {
    return [
      'Info',
      mergeAttributes(HTMLAttributes, {
        primary: node.attrs.primary,
      }),
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'Info',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InfoTagView);
  },

  addKeyboardShortcuts() {
    const isInfoTag = (node?: ProseMirrorNode | null) =>
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
        if (!isInfoTag(nodeBefore)) return false;
        return deleteNodeAt($from.pos - nodeBefore.nodeSize, $from.pos);
      },
      Delete: () => {
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const nodeAfter = $from.nodeAfter;
        if (!isInfoTag(nodeAfter)) return false;
        return deleteNodeAt($from.pos, $from.pos + nodeAfter.nodeSize);
      },
      ArrowLeft: () => {
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const nodeBefore = $from.nodeBefore;
        if (!isInfoTag(nodeBefore)) return false;
        return moveCursorTo($from.pos - nodeBefore.nodeSize);
      },
      ArrowRight: () => {
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const nodeAfter = $from.nodeAfter;
        if (!isInfoTag(nodeAfter)) return false;
        return moveCursorTo($from.pos + nodeAfter.nodeSize);
      },
    };
  },
});
