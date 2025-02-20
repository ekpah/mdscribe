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
      className="h-full w-full"
      onChange={(e) => setContent(e.target.value)}
      value={note}
    />
  );
};
