import React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkIcon } from "@radix-ui/react-icons";
import { MoreHorizontal } from "lucide-react";

export default function SkeletonContentSection() {
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex h-10 items-center gap-2 justify-between">
        <Skeleton className="w-[100px] h-[20px] rounded-full" />
      </div>
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
    </div>
  );
}
