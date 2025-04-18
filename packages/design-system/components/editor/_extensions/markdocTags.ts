import { Extension, Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { PluginKey } from '@tiptap/pm/state';
import { type Editor, ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import type { Instance as TippyInstance } from 'tippy.js';
import tippy from 'tippy.js';
import { MarkdocTagSuggestion } from './MarkdocTagSuggestion.tsx';
// import renderItems from './markdocRenderItems.js';

export interface MarkdocTagAttrs {
  /**
   * The tag name for the Markdoc tag
   */
  tagName: string;

  /**
   * The attributes passed to the tag
   */
  attributes?: Record<string, string> | null;
}

export interface MarkdocTagItem {
  tagName: string;
  attributes?: Record<string, string>;
}

export const MarkdocTagPluginKey = new PluginKey('markdocTag');

export const MarkdocTag = Node.create({
  name: 'markdocTag',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'markdoc-tag',
        style:
          'background-color: #e6f3ff; padding: 0.1em 0.3em; border-radius: 0.2em;',
      },
      renderText({
        node,
        HTMLAttributes,
      }: { node: ProseMirrorNode; HTMLAttributes: Record<string, string> }) {
        const tagName = node.attrs.tagName || '';
        const attrs = node.attrs.attributes
          ? ` ${JSON.stringify(node.attrs.attributes)}`
          : '';
        return `{%${tagName}${attrs}%}`;
      },
      renderHTML({
        node,
        HTMLAttributes,
      }: { node: ProseMirrorNode; HTMLAttributes: Record<string, string> }) {
        return [
          'span',
          mergeAttributes({ 'data-type': 'markdocTag' }, HTMLAttributes, {
            'data-tag-name': node.attrs.tagName,
            'data-attributes': node.attrs.attributes
              ? JSON.stringify(node.attrs.attributes)
              : null,
          }),
          this.renderText({ node, HTMLAttributes }),
        ] as [string, Record<string, string>, string];
      },
      suggestion: {
        char: '/',
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: MarkdocTagItem;
        }) => {
          props.command({ editor, range });
        },
        pluginKey: MarkdocTagPluginKey,
        // render: renderItems,
      },
    };
  },

  group: 'inline',

  inline: true,

  selectable: false,

  atom: true,

  addAttributes() {
    return {
      tagName: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tag-name'),
        renderHTML: (attributes) => {
          if (!attributes.tagName) {
            return {};
          }
          return {
            'data-tag-name': attributes.tagName,
          };
        },
      },
      attributes: {
        default: null,
        parseHTML: (element) => {
          const attrs = element.getAttribute('data-attributes');
          return attrs ? JSON.parse(attrs) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.attributes) {
            return {};
          }
          return {
            'data-attributes': JSON.stringify(attributes.attributes),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="markdocTag"]',
      },
    ];
  },

  renderHTML({ node }) {
    return this.options.renderHTML({
      node,
      HTMLAttributes: this.options.HTMLAttributes,
    });
  },

  renderText({ node }) {
    return this.options.renderText({
      node,
      HTMLAttributes: this.options.HTMLAttributes,
    });
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const MarkdocExtension = Extension.create({
  name: 'markdocExtension',

  addExtensions() {
    return [
      MarkdocTag.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return [{ tagName: 'info' }, { tagName: 'switch' }].filter((item) =>
              item.tagName.toLowerCase().startsWith(query.toLowerCase())
            );
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: TippyInstance | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer(MarkdocTagSuggestion, {
                  props,
                  editor: props.editor,
                });

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate(props) {
                component?.updateProps(props);

                popup?.setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },

              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup?.hide();
                  return true;
                }

                return component?.ref?.onKeyDown(props);
              },

              onExit() {
                popup?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
    ];
  },
});

export { MarkdocTag as default };
