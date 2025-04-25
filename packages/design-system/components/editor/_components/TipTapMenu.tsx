import { Button } from '@repo/design-system/components/ui/button';
import type { Editor } from '@tiptap/react';
import { Redo, Undo } from 'lucide-react';

const MenuBar = ({ editor }: { editor: Editor }) => {
  return (
    <div className="mb-2 flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-muted/40 p-2">
      <div className="flex flex-wrap gap-1">
        <Button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`h-8 px-2 ${editor.isActive('bold') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="font-bold">B</span>
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`h-8 px-2 ${editor.isActive('italic') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="italic">I</span>
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={`h-8 px-2 ${editor.isActive('strike') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="line-through">S</span>
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />

        <Button
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
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`h-8 px-2 ${editor.isActive('heading', { level: 3 }) ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="font-bold text-xs">H3</span>
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />

        <Button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 px-2 ${editor.isActive('bulletList') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="flex items-center">•</span>
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 px-2 ${editor.isActive('orderedList') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="flex items-center">1.</span>
        </Button>

        <Button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`h-8 px-2 ${editor.isActive('blockquote') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <span className="flex items-center">"</span>
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className={`h-8 px-2 ${editor.isActive('undo') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className={`h-8 px-2 ${editor.isActive('redo') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          <Redo className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          onClick={() => alert(editor.getHTML())}
          className={`h-8 px-2 ${editor.isActive('redo') ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
          variant="ghost"
          size="sm"
        >
          Output
        </Button>
      </div>
    </div>
  );
};

export default MenuBar;
