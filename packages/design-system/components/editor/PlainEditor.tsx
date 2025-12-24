'use client';
import { Textarea } from '@repo/design-system/components/ui/textarea';

export default ({
  note,
  setContent,
}: {
  note: string;
  setContent: (content: string) => void;
}) => {
  return (
    <Textarea
      className="h-full w-full resize-none border-0 p-3 focus-visible:ring-0"
      onChange={(e) => setContent(e.target.value)}
      value={note}
    />
  );
};
