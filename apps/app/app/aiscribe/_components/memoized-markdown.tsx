import renderMarkdocAsReact from '@repo/markdoc-md/render/renderMarkdocAsReact';
import { marked } from 'marked';
import { memo, useMemo } from 'react';

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return <>{renderMarkdocAsReact(content)}</>;
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;
    return true;
  }
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

export const MemoizedMarkdown = memo(({ content }: { content: string }) => {
  const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

  return blocks.map((block, index) => (
    <MemoizedMarkdownBlock content={block} key={`block_${index}`} />
  ));
});

MemoizedMarkdown.displayName = 'MemoizedMarkdown';
