'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { orpcClient } from '@/lib/orpc';

interface TextSnippet {
  id: string;
  key: string;
  snippet: string;
}

interface UseTextSnippetsOptions {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  onExpand?: (expandedText: string) => void;
}

export function useTextSnippets(options?: UseTextSnippetsOptions) {
  const { textareaRef, onExpand } = options || {};
  const [snippets, setSnippets] = useState<TextSnippet[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load snippets on mount
  useEffect(() => {
    const loadSnippets = async () => {
      try {
        const data = await orpcClient.user.snippets.list();
        setSnippets(data);
        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading snippets:', error);
        setIsLoaded(true);
      }
    };

    loadSnippets();
  }, []);

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
        toast.error('Kein K?rzel gefunden');
        return;
      }

      const snippet = findSnippet(key);

      if (!snippet) {
        toast.error(`Kein Snippet f?r "${key}" gefunden`);
        return;
      }

      // Replace the key with the snippet
      const textAfterCursor = textarea.value.substring(cursorPosition);
      const newText =
        textBeforeCursor.substring(0, lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1) +
        snippet.snippet +
        textAfterCursor;

      // Update textarea value
      textarea.value = newText;

      // Set cursor position after the inserted snippet
      const newCursorPosition =
        (lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1) + snippet.snippet.length;
      textarea.selectionStart = newCursorPosition;
      textarea.selectionEnd = newCursorPosition;

      // Trigger change event
      const event = new Event('input', { bubbles: true });
      textarea.dispatchEvent(event);

      // Call onExpand callback if provided
      if (onExpand) {
        onExpand(newText);
      }

      toast.success(`Snippet "${key}" erweitert`);
    },
    [findSnippet, onExpand]
  );

  // Handle keyboard shortcut
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for Shift+F2
      if (event.shiftKey && event.key === 'F2') {
        event.preventDefault();

        // If textareaRef is provided, use it
        if (textareaRef?.current) {
          expandSnippet(textareaRef.current);
          return;
        }

        // Otherwise, try to find the focused textarea
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'TEXTAREA') {
          expandSnippet(activeElement as HTMLTextAreaElement);
        } else {
          toast.error('Bitte fokussieren Sie ein Textfeld');
        }
      }
    },
    [expandSnippet, textareaRef]
  );

  // Attach keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    snippets,
    isLoaded,
    expandSnippet,
    findSnippet,
  };
}
