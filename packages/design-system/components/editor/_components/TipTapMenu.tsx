import { Button } from '@repo/design-system/components/ui/button';
import { htmlToMarkdoc } from '@repo/markdoc-md/parse/htmlToMarkdoc';
import type { Editor } from '@tiptap/react';
import { HelpCircle, Redo, Undo } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';

const MenuBar = ({ editor }: { editor: Editor }) => {
  return (
    <div className="mb-2 flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-muted/90 p-2">
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`h-8 px-2 ${editor.isActive('bold') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="font-bold">B</span>
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`h-8 px-2 ${editor.isActive('italic') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="italic">I</span>
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={`h-8 px-2 ${editor.isActive('strike') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="line-through">S</span>
        </Button>

        <div className="mx-1 h-8 w-px bg-border" />

        <Button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`h-8 px-2 ${editor.isActive('heading', { level: 1 }) ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="font-bold text-base">H1</span>
        </Button>
        <Button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`h-8 px-2 ${editor.isActive('heading', { level: 2 }) ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="font-bold text-sm">H2</span>
        </Button>
        <Button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`h-8 px-2 ${editor.isActive('heading', { level: 3 }) ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="font-bold text-xs">H3</span>
        </Button>

        <div className="mx-1 h-8 w-px bg-border" />

        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 px-2 ${editor.isActive('bulletList') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="flex items-center">•</span>
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 px-2 ${editor.isActive('orderedList') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="flex items-center">1.</span>
        </Button>

        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`h-8 px-2 ${editor.isActive('blockquote') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="flex items-center">"</span>
        </Button>

        <div className="mx-1 h-8 w-px bg-border" />
        <Button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className={`h-8 px-2 ${editor.isActive('undo') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className={`h-8 px-2 ${editor.isActive('redo') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <Redo className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-8 w-px bg-border" />
        {process.env.NODE_ENV === 'development' && (
          <Button
            type="button"
            onClick={() =>
              alert(
                `html:\n${editor.storage.markdown.getMarkdown()}\n\nmarkdoc:\n${htmlToMarkdoc(
                  editor.storage.markdown.getMarkdown()
                )}`
              )
            }
            className={`h-8 px-2 ${editor.isActive('redo') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
            variant="ghost"
            size="sm"
          >
            Output
          </Button>
        )}
        <Button
          type="button"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'infoTag',
                attrs: {
                  primary: '...',
                },
              })
              .run()
          }
          className="flex cursor-pointer select-none items-center rounded-l-sm bg-solarized-blue px-1.5 text-white transition-all duration-150 ease-in-out hover:brightness-110 group-hover:bg-solarized-blue/90"
          variant="ghost"
          size="sm"
        >
          <span>Info</span>
        </Button>
        <Button
          type="button"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'switchTag',
                attrs: {
                  primary: '...',
                },
                content: [
                  {
                    type: 'caseTag',
                    attrs: { primary: '' },
                    content: [{ type: 'text', text: '...' }],
                  },
                ],
              })
              .insertContent({ type: 'text', text: ' ' })
              .run()
          }
          className="flex cursor-pointer select-none items-center rounded-l-sm bg-solarized-green px-1.5 text-white transition-all duration-150 ease-in-out hover:brightness-110 group-hover:bg-solarized-green/90"
          variant="ghost"
          size="sm"
        >
          <span>Switch</span>
        </Button>
        
        <Button
          type="button"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'scoreTag',
                attrs: {
                  formula: '',
                  unit: '',
                },
              })
              .run()
          }
          className="flex cursor-pointer select-none items-center rounded-l-sm bg-solarized-orange px-1.5 text-white transition-all duration-150 ease-in-out hover:brightness-110 group-hover:bg-solarized-orange/90"
          variant="ghost"
          size="sm"
        >
          <span>Score</span>
        </Button>

        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger className="h-8 bg-transparent px-2 hover:bg-muted">
              <HelpCircle className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                Dies sind spezielle Tags, die in Ihr Dokument eingefügt werden
                können.
              </p>
              <p className="mt-1">
                <a
                  href="https://docs.mdscribe.de/templates/tags"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Erfahre mehr →
                </a>
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default MenuBar;
