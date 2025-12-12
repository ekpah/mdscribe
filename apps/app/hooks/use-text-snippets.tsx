'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useHotkeys } from 'react-hotkeys-hook';
import { orpc } from '@/lib/orpc';

export function useTextSnippets() {
  const { data: snippets = [], isLoading } = useQuery(
    orpc.user.snippets.list.queryOptions()
  );

  useHotkeys(
    'shift+f2',
    (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'INPUT')
      ) {
        expandSnippet(activeElement as HTMLTextAreaElement | HTMLInputElement);
      } else {
        toast.error('Bitte fokussieren Sie ein Textfeld');
      }
    },
    {
      enableOnFormTags: ['INPUT', 'TEXTAREA'],
    }
  );

  // Find snippet by key
  const findSnippet = useCallback(
    (key: string) => {
      return snippets.find((s) => s.key === key);
    },
    [snippets]
  );

  // Expand snippet in textarea or input
  const expandSnippet = useCallback(
    (textarea: HTMLTextAreaElement | HTMLInputElement) => {
      const cursorPosition = textarea.selectionStart ?? 0;
      const textBeforeCursor = textarea.value.substring(0, cursorPosition);

      // Find the last space before the cursor
      const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
      const key =
        lastSpaceIndex === -1
          ? textBeforeCursor
          : textBeforeCursor.substring(lastSpaceIndex + 1);

      if (!key) {
        toast.error('Kein Kürzel gefunden');
        return;
      }

      const snippet = findSnippet(key);

      if (!snippet) {
        toast.error(`Kein Snippet für "${key}" gefunden`);
        return;
      }

      // Replace the key with the snippet
      const textAfterCursor = textarea.value.substring(cursorPosition ?? 0);
      const newText =
        textBeforeCursor.substring(
          0,
          lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1
        ) +
        snippet.snippet +
        textAfterCursor;

      // Calculate cursor position after the inserted snippet
      const newCursorPosition =
        (lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1) +
        snippet.snippet.length;

      // Update textarea/input value using the native setter
      // This ensures React's onChange handler will see the updated value
      const prototype =
        textarea instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, newText);
      } else {
        textarea.value = newText;
      }

      // Set cursor position after the inserted snippet
      textarea.selectionStart = newCursorPosition;
      textarea.selectionEnd = newCursorPosition;

      // Create and dispatch a React-compatible input event
      // React listens for 'input' events on controlled inputs and will
      // create a synthetic event that triggers the onChange handler
      const inputEvent = new Event('input', {
        bubbles: true,
        cancelable: true,
      });

      // Set target and currentTarget properties that React expects
      Object.defineProperty(inputEvent, 'target', {
        enumerable: true,
        configurable: true,
        value: textarea,
      });
      Object.defineProperty(inputEvent, 'currentTarget', {
        enumerable: true,
        configurable: true,
        value: textarea,
      });

      // Dispatch the event synchronously so React can process it
      // React's event delegation system will intercept this and call onChange
      textarea.dispatchEvent(inputEvent);

      toast.success(`Snippet "${key}" eingefügt`);
    },
    [findSnippet]
  );

  return {
    snippets,
    isLoading,
    expandSnippet,
    findSnippet,
  };
}
