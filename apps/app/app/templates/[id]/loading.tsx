import {
  Bookmark,
  Clock,
  Pencil,
  User,
} from 'lucide-react';
import SkeletonContentSection from './_components/skeleton-content-section';

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 items-center justify-between gap-2">
        <div className="font-bold">...</div>
        <div className="flex h-10 items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
              <User />
              Autor: TBD
            </div>

            <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
              <Clock />
              Zuletzt bearbeitet am ??.??.????
            </div>
            <Bookmark />
            <span className="flex w-12 flex-row font-medium text-muted-foreground">
              X Likes
            </span>
            <Pencil />
          </div>
        </div>
      </div>
      <SkeletonContentSection />
    </div>
  );
}
