import { Skeleton } from '@repo/design-system/components/ui/skeleton';
import SkeletonEditor from './_components/SkeletonEditor';

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 items-center justify-between gap-2">
        <Skeleton className="h-[20px] w-[100px] rounded-full" />
      </div>
      <SkeletonEditor />
    </div>
  );
}
