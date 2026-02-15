import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type MarkdocTagName = 'info' | 'score' | 'switch' | 'case';

export interface MarkdocValidationHighlight {
  tagName: MarkdocTagName;
  index: number;
  message: string;
}

interface MarkdocValidationState {
  highlights: MarkdocValidationHighlight[];
  decorations: DecorationSet;
}

interface MarkdocValidationMeta {
  highlights: MarkdocValidationHighlight[];
}

const validationKey = new PluginKey<MarkdocValidationState>('markdocValidation');

const errorDecorationClassName =
  'markdoc-validation-error underline decoration-wavy decoration-solarized-red decoration-2 underline-offset-2';

const getNodeTagName = (nodeTypeName: string): MarkdocTagName | null => {
  switch (nodeTypeName) {
    case 'infoTag':
      return 'info';
    case 'scoreTag':
      return 'score';
    case 'switchTag':
      return 'switch';
    case 'caseTag':
      return 'case';
    default:
      return null;
  }
};

const buildDecorations = (
  doc: ProseMirrorNode,
  highlights: MarkdocValidationHighlight[],
) => {
  if (highlights.length === 0) {
    return DecorationSet.empty;
  }

  const highlightMap = new Map<string, string>();
  for (const highlight of highlights) {
    const key = `${highlight.tagName}:${highlight.index}`;
    const existingMessage = highlightMap.get(key);
    if (existingMessage) {
      highlightMap.set(key, `${existingMessage}\n${highlight.message}`);
    } else {
      highlightMap.set(key, highlight.message);
    }
  }

  const counts: Record<MarkdocTagName, number> = {
    info: 0,
    score: 0,
    switch: 0,
    case: 0,
  };

  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    const tagName = getNodeTagName(node.type.name);
    if (!tagName) {
      return;
    }

    const index = counts[tagName];
    counts[tagName] = index + 1;

    const message = highlightMap.get(`${tagName}:${index}`);
    if (!message) {
      return;
    }

    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: errorDecorationClassName,
        title: message,
      }),
    );
  });

  return DecorationSet.create(doc, decorations);
};

export const MarkdocValidation = Extension.create({
  name: 'markdocValidation',

  addCommands() {
    return {
      setMarkdocValidation:
        (highlights: MarkdocValidationHighlight[]) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(validationKey, { highlights }));
          }

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: validationKey,
        state: {
          init: () => ({
            highlights: [],
            decorations: DecorationSet.empty,
          }),
          apply: (tr, pluginState, _oldState, newState) => {
            const meta = tr.getMeta(validationKey) as
              | MarkdocValidationMeta
              | undefined;
            const hasMeta = meta !== undefined;
            const nextHighlights = hasMeta ? meta.highlights : pluginState.highlights;

            if (hasMeta || tr.docChanged) {
              return {
                highlights: nextHighlights,
                decorations: buildDecorations(newState.doc, nextHighlights),
              };
            }

            return pluginState;
          },
        },
        props: {
          decorations: (state) => validationKey.getState(state)?.decorations ?? null,
        },
      }),
    ];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    markdocValidation: {
      setMarkdocValidation: (
        highlights: MarkdocValidationHighlight[],
      ) => ReturnType;
    };
  }
}
