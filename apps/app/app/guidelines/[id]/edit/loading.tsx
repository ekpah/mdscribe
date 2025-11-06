import { Skeleton } from '@repo/design-system/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 p-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
