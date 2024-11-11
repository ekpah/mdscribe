import {} from '@radix-ui/react-icons';
import { Card } from '@repo/design-system/components/ui/card';
import {} from '@repo/design-system/components/ui/popover';
import { Skeleton } from '@repo/design-system/components/ui/skeleton';

export default function SkeletonContentSection() {
  return (
    <Card className="grid grid-cols-3 gap-4 h-[calc(100vh-theme(spacing.16)-theme(spacing.10)-2rem)] overflow-hidden">
      <div key="Inputs" className="p-4 overflow-y-auto overscroll-none">
        <Skeleton className="w-[100px] h-[20px] rounded-full" />
      </div>
      <div
        key="Note"
        className="overflow-y-auto overscroll-none col-span-2 border-l p-4"
      >
        <Skeleton className="w-[100px] h-[20px] rounded-full" />
      </div>
    </Card>
  );
}
