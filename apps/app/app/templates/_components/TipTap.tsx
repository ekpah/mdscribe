'use client';

import {
  BubbleMenu,
  EditorProvider,
  FloatingMenu,
  useCurrentEditor,
} from '@tiptap/react';

import { Button } from '@repo/design-system/components/ui/button';
import { cn } from '@repo/design-system/lib/utils';
import StarterKit from '@tiptap/starter-kit';

import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';

const MenuBar = () => {
  const { editor } = useCurrentEditor();

  if (!editor) {
    return null;
  }

  return (
    <div className="control-group">
      <div className="button-group">
        <Button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
        >
          Bold
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
        >
          Italic
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
        >
          Strike
        </Button>

        <Button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={editor.isActive('paragraph') ? 'is-active' : ''}
        >
          Paragraph
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={
            editor.isActive('heading', { level: 1 }) ? 'is-active' : ''
          }
        >
          H1
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor.isActive('heading', { level: 2 }) ? 'is-active' : ''
          }
        >
          H2
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={
            editor.isActive('heading', { level: 3 }) ? 'is-active' : ''
          }
        >
          H3
        </Button>

        <Button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
        >
          Bullet list
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
        >
          Ordered list
        </Button>

        <Button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''}
        >
          Blockquote
        </Button>

        <Button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
        >
          Undo
        </Button>
        <Button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
        >
          Redo
        </Button>
      </div>
    </div>
  );
};

const extensions = [StarterKit];

const content = `
<h2>
  Hi there,
</h2>
<p>
  this is a <em>basic</em> example of <strong>Tiptap</strong>. Sure, there are all kind of basic text styles you’d probably expect from a text editor. But wait until you see the lists:
</p>
<ul>
  <li>
    That’s a bullet list with one …
  </li>
  <li>
    … or two list items.
  </li>
</ul>
<p>
  Isn’t that great? And all of that is editable. But wait, there’s more. Let’s try a code block:
</p>
<pre><code class="language-css">body {
  display: none;
}</code></pre>
<p>
  I know, I know, this is impressive. It’s only the tip of the iceberg though. Give it a try and click a little bit around. Don’t forget to check the other examples too.
</p>
<blockquote>
  Wow, that’s amazing. Good work, boy! 👏
  <br />
  — Mom
</blockquote>
`;

export default ({
  note,
  setContent,
}: { note: string; setContent: (content: string) => void }) => {
  const parsed = defaultMarkdownParser.parse(note);
  console.log(note);
  console.log(parsed);
  console.log(defaultMarkdownSerializer.serialize(parsed));
  return (
    <EditorProvider
      editorProps={{
        attributes: {
          class: cn(
            'flex h-full w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            'h-full w-full'
          ),
        },
      }}
      // slotBefore={<MenuBar />}
      immediatelyRender={false}
      extensions={extensions}
      content={note ?? defaultMarkdownParser.parse(note)}
      onUpdate={({ editor }) => {
        const markdown = defaultMarkdownSerializer.serialize(editor.state.doc);
        setContent(markdown);
      }}
    >
      <FloatingMenu editor={null}>This is the floating menu</FloatingMenu>
      <BubbleMenu editor={null}>This is the bubble menu</BubbleMenu>
    </EditorProvider>
  );
};
/*
import {
  MarkdownSerializer as ProseMirrorMarkdownSerializer,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';
import { marked } from 'marked';
import { DOMParser as ProseMirrorDOMParser } from 'prosemirror-model';
import './TipTap.css';
import lowlight from 'lowlight';

import Paragraph from '@tiptap/extension-paragraph';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import OrderedList from '@tiptap/extension-ordered-list';
import Strike from '@tiptap/extension-strike';
import Italic from '@tiptap/extension-italic';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import HardBreak from '@tiptap/extension-hard-break';
import Code from '@tiptap/extension-code';
import Bold from '@tiptap/extension-bold';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Link from '@tiptap/extension-link';

const tableMap = new WeakMap();

function isInTable(node) {
  return tableMap.has(node);
}

export function renderHardBreak(state, node, parent, index) {
  const br = isInTable(parent) ? '<br>' : '\\\n';
  for (let i = index + 1; i < parent.childCount; i += 1) {
    if (parent.child(i).type !== node.type) {
      state.write(br);
      return;
    }
  }
}

export function renderOrderedList(state, node) {
  const { parens } = node.attrs;
  const start = node.attrs.start || 1;
  const maxW = String(start + node.childCount - 1).length;
  const space = state.repeat(' ', maxW + 2);
  const delimiter = parens ? ')' : '.';
  state.renderList(node, space, (i) => {
    const nStr = String(start + i);
    return `${state.repeat(' ', maxW - nStr.length) + nStr}${delimiter} `;
  });
}

export function isPlainURL(link, parent, index, side) {
  if (link.attrs.title || !/^\w+:/.test(link.attrs.href)) return false;
  const content = parent.child(index + (side < 0 ? -1 : 0));
  if (
    !content.isText ||
    content.text !== link.attrs.href ||
    content.marks[content.marks.length - 1] !== link
  )
    return false;
  if (index === (side < 0 ? 1 : parent.childCount - 1)) return true;
  const next = parent.child(index + (side < 0 ? -2 : 1));
  return !link.isInSet(next.marks);
}

const serializerMarks = {
  ...defaultMarkdownSerializer.marks,
  [Bold.name]: defaultMarkdownSerializer.marks.strong,
  [Strike.name]: {
    open: '~~',
    close: '~~',
    mixable: true,
    expelEnclosingWhitespace: true,
  },
  [Italic.name]: {
    open: '_',
    close: '_',
    mixable: true,
    expelEnclosingWhitespace: true,
  },
  [Code.name]: defaultMarkdownSerializer.marks.code,
  [Link.name]: {
    open(state, mark, parent, index) {
      return isPlainURL(mark, parent, index, 1) ? '<' : '[';
    },
    close(state, mark, parent, index) {
      const href = mark.attrs.canonicalSrc || mark.attrs.href;

      return isPlainURL(mark, parent, index, -1)
        ? '>'
        : `](${state.esc(href)}${
            mark.attrs.title ? ` ${state.quote(mark.attrs.title)}` : ''
          })`;
    },
  },
};

const serializerNodes = {
  ...defaultMarkdownSerializer.nodes,
  [Paragraph.name]: defaultMarkdownSerializer.nodes.paragraph,
  [BulletList.name]: defaultMarkdownSerializer.nodes.bullet_list,
  [ListItem.name]: defaultMarkdownSerializer.nodes.list_item,
  [HorizontalRule.name]: defaultMarkdownSerializer.nodes.horizontal_rule,
  [OrderedList.name]: renderOrderedList,
  [HardBreak.name]: renderHardBreak,
  [CodeBlockLowlight.name]: (state, node) => {
    state.write(`\`\`\`${node.attrs.language || ''}\n`);
    state.text(node.textContent, false);
    state.ensureNewLine();
    state.write('```');
    state.closeBlock(node);
  },
  [Blockquote.name]: (state, node) => {
    if (node.attrs.multiline) {
      state.write('>>>');
      state.ensureNewLine();
      state.renderContent(node);
      state.ensureNewLine();
      state.write('>>>');
      state.closeBlock(node);
    } else {
      state.wrapBlock('> ', null, node, () => state.renderContent(node));
    }
  },
};

function serialize(schema, content) {
  const proseMirrorDocument = schema.nodeFromJSON(content);
  const serializer = new ProseMirrorMarkdownSerializer(
    serializerNodes,
    serializerMarks
  );

  return serializer.serialize(proseMirrorDocument, {
    tightLists: true,
  });
}

function deserialize(schema, content) {
  const html = marked.parse(content);

  if (!html) return null;

  const parser = new DOMParser();
  const { body } = parser.parseFromString(html, 'text/html');

  // append original source as a comment that nodes can access
  body.append(document.createComment(content));

  const state = ProseMirrorDOMParser.fromSchema(schema).parse(body);

  return state.toJSON();
}

const Tiptap = () => {
  const [markdownInput, setMarkdownInput] = useState('');
  const [markdownOutput, setMarkdownOutput] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      // FIXME: this isn't working
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Link,
    ],
    // content: "<h1>This is a heading</h1>\n<p>This is a paragraph</p>",
    content: `
      <h1>This is heading</h1>
      <h3>This is sub-heading</h3>
      <a href="https://github.com/justinmoon/tiptap-markdown-demo">Link to this repo</a>
      <p>TipTap is <s>Vue-only</s> <strong>powerful</strong> and <em>configurable</em> editor framework.</p>
      `,
    onCreate({ editor }) {
      setMarkdownOutput(serialize(editor.schema, editor.getJSON()));
    },
    onUpdate: ({ editor }) => {
      setMarkdownOutput(serialize(editor.schema, editor.getJSON()));
    },
  });

  function loadMarkdownInput() {
    const deserialized = deserialize(editor.schema, markdownInput);
    editor.commands.setContent(deserialized);
    setMarkdownInput('');
    // FIXME: setConent() doesn't trigger onUpdate ...
    setMarkdownOutput(serialize(editor.schema, editor.getJSON()));
  }

  return (
    <div className="container">
      <h3 className="heading">TipTap editor:</h3>
      <EditorContent className="section" editor={editor} />
      <h3 className="heading">Markdown → TipTap:</h3>
      <div className="section">
        <textarea
          className="input"
          value={markdownInput}
          rows={6}
          onChange={(e) => setMarkdownInput(e.target.value)}
        ></textarea>
        <div className="flex">
          <button className="button" onClick={loadMarkdownInput}>
            Load
          </button>
        </div>
      </div>
      <h3 className="heading">TipTap → Markdown</h3>
      <pre className="section pre-wrap">{markdownOutput}</pre>
    </div>
  );
};

export default Tiptap;*/
