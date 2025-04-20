import type { SuggestionProps } from '@tiptap/suggestion';
import { Command } from 'cmdk';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import type { MarkdocTagItem } from './markdocTags.js';

export interface MarkdocTagSuggestionProps {
  items: MarkdocTagItem[];
  command: (item: MarkdocTagItem) => void;
}

export const MarkdocTagSuggestion = forwardRef<
  HTMLDivElement,
  SuggestionProps<MarkdocTagItem>
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    },
    [props]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const navigationKeys = ['ArrowUp', 'ArrowDown', 'Enter'];
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowUp') {
          setSelectedIndex(
            (selectedIndex + props.items.length - 1) % props.items.length
          );
          return true;
        }
        if (e.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % props.items.length);
          return true;
        }
        if (e.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      }
    },
    [props.items.length, selectedIndex, selectItem]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Reset selection when items change
  const itemsKey = props.items.map((item) => item.tagName).join(',');
  useEffect(() => {
    setSelectedIndex(0);
  }, [itemsKey]);

  if (props.items.length === 0) {
    return null;
  }

  const rect = props.clientRect?.();
  const left = rect?.left ?? 0;
  const top = (rect?.top ?? 0) + 24;

  return (
    <div
      ref={ref}
      className="z-50 h-auto max-h-[250px] w-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
      style={{
        position: 'absolute',
        left,
        top,
      }}
    >
      <Command>
        <Command.List>
          {props.items.map((item, index) => (
            <Command.Item
              key={item.tagName}
              onSelect={() => selectItem(index)}
              className={`flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm ${
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'text-popover-foreground'
              }`}
            >
              <span className="mr-2">{'{% '}</span>
              {item.tagName}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
});

MarkdocTagSuggestion.displayName = 'MarkdocTagSuggestion';
