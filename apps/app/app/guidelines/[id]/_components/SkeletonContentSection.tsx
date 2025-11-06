'use client';

import { Card, CardContent } from '@repo/design-system/components/ui/card';
import { Skeleton } from '@repo/design-system/components/ui/skeleton';

export default function SkeletonContentSection() {
  return (
    <Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
      <div
        className="hidden overflow-y-auto overscroll-none p-4 md:block"
        key="Inputs"
      >
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </div>
      <div
        className="col-span-3 overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
        key="Note"
      >
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
