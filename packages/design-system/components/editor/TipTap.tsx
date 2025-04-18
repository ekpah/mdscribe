'use client';

import {
  Slash,
  SlashCmd,
  SlashCmdProvider,
  createSuggestionsItems,
  enableKeyboardNavigation,
} from '@harshtalks/slash-tiptap';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {} from 'lucide-react';
import { Markdown } from 'tiptap-markdown';
import TipTapMenu from './_components/TipTapMenu';

const suggestions = createSuggestionsItems([
  {
    title: 'text',
    searchTerms: ['paragraph'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .run();
    },
  },
  {
    title: 'Bullet List',
    searchTerms: ['unordered', 'point'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Ordered List',
    searchTerms: ['ordered', 'point', 'numbers'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
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
        placeholder: 'Press / to see available commands',
        // Use different placeholders depending on the node type:
        // placeholder: ({ node }) => {
        //   if (node.type.name === 'heading') {
        //     return 'What’s the title?'
        //   }

        //   return 'Can you add some further context?'
        // },
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
        class: 'prose prose-sm sm:prose mx-auto focus:outline-none',
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
            <SlashCmd.Empty>No commands available</SlashCmd.Empty>
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
