import { Skeleton } from '@repo/design-system/components/ui/skeleton';
import SkeletonEditor from './_components/SkeletonEditor';

export default function Loading({ params }) {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex h-10 items-center gap-2 justify-between">
        <Skeleton className="w-[100px] h-[20px] rounded-full" />
      </div>
      <SkeletonEditor />
    </div>
  );
}
