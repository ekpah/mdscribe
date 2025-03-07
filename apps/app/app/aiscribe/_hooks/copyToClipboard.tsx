'use client';

import { useCallback, useEffect, useState } from 'react';

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    if ('clipboard' in navigator) {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
    } else {
      document.execCommand('copy', true, text);
      setIsCopied(true);
    }
  }, []);

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  return { isCopied, copyToClipboard };
}
