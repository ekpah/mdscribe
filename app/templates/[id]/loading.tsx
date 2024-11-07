import {
  BookmarkIcon,
  ClockIcon,
  Pencil2Icon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { NavActions } from "./_components/NavActions";
import SkeletonContentSection from "./_components/SkeletonContentSection";

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex h-10 items-center gap-2 justify-between">
        <div className="font-bold">...</div>
        <div className="flex h-10 items-center gap-2 justify-between">
          <div className="flex items-center gap-2 text-sm">
            <div className="hidden font-medium text-muted-foreground lg:flex-row lg:inline-flex items-center lg:gap-1">
              <PersonIcon />
              Autor: TBD
            </div>

            <div className="hidden items-center font-medium text-muted-foreground lg:flex-row lg:inline-flex lg:gap-1">
              <ClockIcon />
              Zuletzt bearbeitet am ??.??.????
            </div>
            <BookmarkIcon />
            <span className="flex flex-row w-12 font-medium text-muted-foreground">
              X Likes
            </span>
            <Pencil2Icon />
          </div>
        </div>
      </div>
      <SkeletonContentSection />
    </div>
  );
}
