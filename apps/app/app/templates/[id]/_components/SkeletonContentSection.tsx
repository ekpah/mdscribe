import { Card } from '@repo/design-system/components/ui/card';
import { Skeleton } from '@repo/design-system/components/ui/skeleton';

export default function SkeletonContentSection() {
  return (
    <Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
      <div key="Inputs" className="overflow-y-auto overscroll-none p-4">
        <Skeleton className="h-[20px] w-[100px] rounded-full" />
      </div>
      <div
        key="Note"
        className="col-span-2 overflow-y-auto overscroll-none border-l p-4"
      >
        <Skeleton className="h-[20px] w-[100px] rounded-full" />
      </div>
    </Card>
  );
}
