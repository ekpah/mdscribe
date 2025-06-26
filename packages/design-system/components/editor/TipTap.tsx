'use client';

import {
  Slash,
  SlashCmd,
  SlashCmdProvider,
  createSuggestionsItems,
  enableKeyboardNavigation,
} from '@harshtalks/slash-tiptap';
import { MarkdocMD } from '@repo/design-system/components/editor/tiptap-extension';
import { cn } from '@repo/design-system/lib/utils';
import { htmlToMarkdoc } from '@repo/markdoc-md/parse/htmlToMarkdoc';
import { renderTipTapHTML } from '@repo/markdoc-md/render/renderNote';
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
          type: 'infoTag',
          attrs: {
            primary: '...',
          },
        })
        .setNodeSelection(range.from)
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
          type: 'switchTag',
          attrs: {
            primary: '...',
          },
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
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Markdown,
      MarkdocMD,
      Slash.configure({
        suggestion: {
          items: () => suggestions,
        },
      }),
      // Placeholder.configure({
      //   placeholder: ({ node }) => {
      //     return 'Ergänze hier deinen Textbaustein...';
      //   },
      // }),
    ],
    content: renderTipTapHTML(note),
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      setContent(htmlToMarkdoc(markdown));
    },
    editorProps: {
      handleDOMEvents: {
        keydown: (_, v) => enableKeyboardNavigation(v),
      },
      attributes: {
        class: cn(
          'prose h-full w-full max-w-none whitespace-pre-wrap focus:outline-none',
          '[&_.is-empty]:relative',
          '[&_.is-empty]:before:content-[attr(data-placeholder)]',
          '[&_.is-empty]:before:text-slate-400',
          '[&_.is-empty]:before:float-left',
          '[&_.is-empty]:before:h-0',
          '[&_.is-empty]:before:pointer-events-none'
        ),
      },
    },
    autofocus: true,
    injectCSS: false,
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="sticky top-0 z-10">
        <TipTapMenu editor={editor} />
      </div>
      <SlashCmdProvider>
        <EditorContent editor={editor} />
        <SlashCmd.Root editor={editor}>
          <SlashCmd.Cmd className="w-full max-w-[640px] overflow-hidden rounded-lg bg-white p-0 font-sans shadow-md outline-none dark:bg-[linear-gradient(136.61deg,rgb(39,40,43)_13.72%,rgb(45,46,49)_74.3%)]">
            <SlashCmd.List className="h-[min(300px,var(--cmdk-list-height))] max-h-[400px] overflow-auto overscroll-contain transition-[height] duration-100 ease-in">
              {suggestions.map((item) => {
                return (
                  <SlashCmd.Item
                    value={item.title}
                    onCommand={(val) => {
                      item.command(val);
                    }}
                    key={item.title}
                    className="relative mt-1 flex h-12 cursor-pointer select-none items-center gap-3 px-4 text-gray-900 text-sm transition-all duration-150 ease-in will-change-[background,color] content-visibility-auto first:mt-0 active:bg-gray-200 active:transition-[background] data-[disabled=true]:cursor-not-allowed data-[selected=true]:bg-gray-100 data-[disabled=true]:text-gray-400 data-[selected=true]:after:absolute data-[selected=true]:after:left-0 data-[selected=true]:after:z-[123] data-[selected=true]:after:h-full data-[selected=true]:after:w-[3px] data-[selected=true]:after:bg-[#5f6ad2] data-[selected=true]:after:content-[''] dark:text-gray-100 dark:data-[selected=true]:bg-gray-800 dark:active:bg-gray-700"
                  >
                    <p>{item.title}</p>
                  </SlashCmd.Item>
                );
              })}
            </SlashCmd.List>
          </SlashCmd.Cmd>
        </SlashCmd.Root>
      </SlashCmdProvider>
    </div>
  );
}
