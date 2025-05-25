'use client';
import { DynamicMarkdocRenderer } from '@repo/markdoc-md';
import { Check, Copy } from 'lucide-react';
import { marked } from 'marked';
import { memo, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

interface MemoizedCopySectionProps {
  title: string;
  content: string;
  values?: Record<string, unknown>;
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({
    content,
    values,
  }: { content: string; values?: Record<string, unknown> }) => {
    return (
      <DynamicMarkdocRenderer variables={values} markdocContent={content} />
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;
    if (JSON.stringify(prevProps.values) !== JSON.stringify(nextProps.values))
      return false;
    return true;
  }
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

export const MemoizedCopySection = memo(
  ({ title, content, values }: MemoizedCopySectionProps) => {
    const [isCopied, setIsCopied] = useState(false);
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    const handleCopy = async (renderedContent: string, textContent: string) => {
      try {
        // Try to write HTML to clipboard
        const htmlString = renderedContent || '';
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlString], {
            type: 'text/html',
          }),
          'text/plain': new Blob([textContent || ''], { type: 'text/plain' }),
        });

        await navigator.clipboard.write([clipboardItem]);
        setIsCopied(true);
        toast.success('Text kopiert (Rich-Text Format)');
      } catch (error) {
        // Fallback to plain text if rich text copy fails
        await navigator.clipboard.writeText(textContent || '');
        toast.success('Text kopiert (Einfacher Text)');
        setIsCopied(true);
      } finally {
        setTimeout(() => setIsCopied(false), 2000);
      }
    };

    return (
      <div className="space-y-2">
        <h3 className="font-medium text-lg capitalize">{title}</h3>
        <button
          type="button"
          tabIndex={0}
          className="group relative w-full cursor-pointer whitespace-pre-line rounded-md bg-muted p-3 text-left transition-colors hover:bg-muted/80"
          onClick={() => {
            // Get the rendered content from the DOM
            const contentElement: HTMLElement | null = document.querySelector(
              `[data-section="${title}"]`
            );
            if (contentElement) {
              const renderedContent = contentElement.innerHTML;
              const textContent = contentElement.innerText || '';
              handleCopy(renderedContent, textContent);
            } else {
              handleCopy(content, content);
            }
          }}
        >
          <div data-section={title}>
            {blocks.map((block, index) => (
              <MemoizedMarkdownBlock
                content={block}
                values={values}
                key={`block_${index}`}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute top-2 right-2 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100">
            {isCopied ? (
              <Check className="h-4 w-4 text-solarized-green" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </div>
        </button>
      </div>
    );
  }
);

MemoizedCopySection.displayName = 'MemoizedCopySection';
