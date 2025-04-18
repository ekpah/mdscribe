import { ReactRenderer } from '@tiptap/react';
import type React from 'react';

import type { SuggestionOptions } from '@tiptap/suggestion';
import tippy, { type Instance, type Props } from 'tippy.js';
import CommandTunnelOutlet from '../components/command-outlet';

const renderItems: SuggestionOptions['render'] = (
  elementRef?: React.RefObject<Element> | null
) => {
  let component: ReactRenderer | null = null;
  let popup: Instance<Props>[] | null = null;

  return {
    onStart: (props) => {
      const { editor, clientRect } = props;

      component = new ReactRenderer(CommandTunnelOutlet, {
        editor: editor,
        props,
      });

      const { selection } = editor.state;
      const parentNode = selection.$from.node(selection.$from.depth);
      const blockType = parentNode.type.name;

      if (blockType === 'codeBlock') {
        return false;
      }

      // @ts-ignore
      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => (elementRef ? elementRef.current : document.body),
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },

    onUpdate: (props) => {
      component?.updateProps(props);

      popup?.[0]?.setProps({
        // @ts-ignore
        getReferenceClientRect: props.clientRect,
      });
    },

    onKeyDown: (props) => {
      if (props.event.key === 'Escape') {
        popup?.[0]?.hide();

        return true;
      }

      // @ts-ignore
      return component?.ref?.onKeyDown(props);
    },

    onExit: () => {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
};

export default renderItems;
