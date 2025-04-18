'use client';

import {
  Slash,
  SlashCmd,
  SlashCmdProvider,
  createSuggestionsItems,
  enableKeyboardNavigation,
} from '@harshtalks/slash-tiptap';
import { cn } from '@repo/design-system/lib/utils';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import TipTapMenu from './_components/TipTapMenu';

const suggestions = createSuggestionsItems([
  {
    title: 'Info-Tag',
    searchTerms: ['info'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '{% info "" /%}',
            },
          ],
        })
        .run();
    },
  },
  {
    title: 'Switch-Tag',
    searchTerms: ['switch'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '{% switch "" /%}',
            },
          ],
        })
        .run();
    },
  },
]);

export default function TipTap({
  note,
  setContent,
}: { note: string; setContent: (content: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      // MarkdocExtension,
      Slash.configure({
        suggestion: {
          items: () => suggestions,
        },
      }),
      Placeholder.configure({
        // Use a placeholder:
        //placeholder: 'Press / to see available commands',
        // Use different placeholders depending on the node type:
        placeholder: ({ node }) => {
          return 'Ergänze hier deinen Textbaustein...';
        },
      }),
    ],
    content: note,
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      setContent(markdown);
    },
    editorProps: {
      handleDOMEvents: {
        keydown: (_, v) => enableKeyboardNavigation(v),
      },
      attributes: {
        class: cn(
          'prose prose-sm sm:prose mx-auto focus:outline-none',
          // Add the styling with Tailwind classes for the Placeholder from TipTap
          '[&_.is-empty]:relative',
          '[&_.is-empty]:before:content-[attr(data-placeholder)]',
          '[&_.is-empty]:before:text-slate-400',
          '[&_.is-empty]:before:float-left',
          '[&_.is-empty]:before:h-0',
          '[&_.is-empty]:before:pointer-events-none'
        ),
      },
    },
    // place the cursor in the editor after initialization
    autofocus: true,
    // prevent loading the default CSS (which isn't much anyway)
    injectCSS: false,
  });

  if (!editor) {
    return null;
  }

  return (
    <>
      <TipTapMenu editor={editor} />
      <SlashCmdProvider>
        <EditorContent editor={editor} />
        <SlashCmd.Root editor={editor}>
          <SlashCmd.Cmd>
            <SlashCmd.List>
              {suggestions.map((item) => {
                return (
                  <SlashCmd.Item
                    value={item.title}
                    onCommand={(val) => {
                      item.command(val);
                    }}
                    key={item.title}
                  >
                    <p>{item.title}</p>
                  </SlashCmd.Item>
                );
              })}
            </SlashCmd.List>
          </SlashCmd.Cmd>
        </SlashCmd.Root>
      </SlashCmdProvider>
    </>
  );
}
