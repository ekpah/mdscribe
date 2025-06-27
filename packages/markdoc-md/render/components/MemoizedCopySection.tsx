'use client';
import Markdoc from '@markdoc/markdoc';
import { Check, Copy } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DynamicMarkdocRenderer } from './DynamicMarkdocRenderer';

interface MemoizedCopySectionProps {
  title?: string;
  content: string;
  values?: Record<string, unknown>;
}

function parseMarkdocIntoBlocks(markdown: string): string[] {
  // Parse with Markdoc to validate syntax, but use line-by-line for block extraction
  try {
    Markdoc.parse(markdown); // This validates the Markdoc syntax
  } catch (error) {
    console.warn(
      'Markdoc parsing error, falling back to basic parsing:',
      error
    );
  }

  const blocks: string[] = [];
  const lines = markdown.split('\n');
  let currentBlock = '';
  let inMarkdocTag = false;
  let tagDepth = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for Markdoc opening tags (not self-closing)
    const openTagMatches = trimmedLine.match(/\{%\s*([^/\s]+)/g);
    // Check for Markdoc closing tags
    const closeTagMatches = trimmedLine.match(/\{%\s*\/([^/\s]+)/g);
    // Check for self-closing tags
    const selfClosingMatches = trimmedLine.match(/\{%.*\/%\}/g);

    if (openTagMatches && !selfClosingMatches) {
      if (!inMarkdocTag && currentBlock.trim()) {
        blocks.push(currentBlock.trim());
        currentBlock = '';
      }
      inMarkdocTag = true;
      tagDepth += openTagMatches.length;
    }

    if (closeTagMatches) {
      tagDepth -= closeTagMatches.length;
      if (tagDepth <= 0) {
        inMarkdocTag = false;
        tagDepth = 0;
        // Add the line to complete the tag block
        currentBlock = currentBlock ? `${currentBlock}\n${line}` : line;
        blocks.push(currentBlock.trim());
        currentBlock = '';
        continue;
      }
    }

    currentBlock = currentBlock ? `${currentBlock}\n${line}` : line;

    // Natural break points when not in tags
    if (
      !inMarkdocTag &&
      currentBlock.trim() &&
      (trimmedLine.match(/^#{1,6}\s/) ||
        trimmedLine.match(/^[-*_]{3,}$/) ||
        (trimmedLine === '' && currentBlock.trim()))
    ) {
      blocks.push(currentBlock.trim());
      currentBlock = '';
    }
  }

  if (currentBlock.trim()) {
    blocks.push(currentBlock.trim());
  }

  return blocks.filter((block) => block.length > 0);
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
    const blocks = useMemo(() => parseMarkdocIntoBlocks(content), [content]);

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
        {title && <h3 className="font-medium text-lg capitalize">{title}</h3>}
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
