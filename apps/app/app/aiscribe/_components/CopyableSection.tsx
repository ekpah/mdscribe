'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { MemoizedMarkdown } from './memoized-markdown';

interface CopyableSectionProps {
  title: string;
  content: string;
}

export function CopyableSection({ title, content }: CopyableSectionProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setIsCopied(true);
    toast.success('Text kopiert');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-lg capitalize">{title}</h3>
      <button
        type="button"
        tabIndex={0}
        className="group relative w-full cursor-pointer whitespace-pre-line rounded-md bg-muted p-3 transition-colors hover:bg-muted/80"
        onClick={handleCopy}
        onKeyDown={(e) => e.key === 'Enter' && handleCopy()}
      >
        <MemoizedMarkdown content={content} />
        <div className="pointer-events-none absolute top-2 right-2 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isCopied ? (
            <Check className="h-4 w-4 text-[--solarized-green]" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </div>
      </button>
    </div>
  );
}
