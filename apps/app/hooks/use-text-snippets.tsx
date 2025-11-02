'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useHotkeys } from 'react-hotkeys-hook';
import { orpc } from '@/lib/orpc';

interface UseTextSnippetsOptions {
  onExpand?: (expandedText: string) => void;
}

export function useTextSnippets(options?: UseTextSnippetsOptions) {
  const { onExpand } = options || {};

  const { data: snippets = [], isLoading } = useQuery(
    orpc.user.snippets.list.queryOptions()
  );

  useHotkeys(
    'shift+f2',
    (event: KeyboardEvent) => {
      console.log('shift+1');
      event.preventDefault();
      event.stopPropagation();
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'TEXTAREA') {
        expandSnippet(activeElement as HTMLTextAreaElement);
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

  // Expand snippet in textarea
  const expandSnippet = useCallback(
    (textarea: HTMLTextAreaElement) => {
      const cursorPosition = textarea.selectionStart;
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
      const textAfterCursor = textarea.value.substring(cursorPosition);
      const newText =
        textBeforeCursor.substring(
          0,
          lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1
        ) +
        snippet.snippet +
        textAfterCursor;

      // Update textarea value
      textarea.value = newText;

      // Set cursor position after the inserted snippet
      const newCursorPosition =
        (lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1) +
        snippet.snippet.length;
      textarea.selectionStart = newCursorPosition;
      textarea.selectionEnd = newCursorPosition;

      // Trigger change event
      const event = new Event('input', { bubbles: true });
      textarea.dispatchEvent(event);

      // Call onExpand callback if provided
      if (onExpand) {
        onExpand(newText);
      }

      toast.success(`Snippet "${key}" eingefügt`);
    },
    [findSnippet, onExpand]
  );

  return {
    snippets,
    isLoading,
    expandSnippet,
    findSnippet,
  };
}
