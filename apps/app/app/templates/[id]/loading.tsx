import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Clock, File, FolderPlus, Pencil, User } from "lucide-react";

import SkeletonContentSection from "./_components/skeleton-content-section";

export default function Loading() {
	// You can add any UI inside Loading, including a Skeleton.
	const iconProps = {
		className: "h-4 w-4 shrink-0",
		strokeWidth: 2,
	} as const;

	return (
		<div className="flex h-full w-full flex-col">
			<div className="flex h-10 items-center justify-between gap-2">
				<div className="font-bold">...</div>
				<div className="flex h-10 items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2 text-sm">
						<span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground">
							<File {...iconProps} />
						</span>

						<div className="hidden min-w-0 max-w-[28ch] items-center gap-1.5 font-medium text-muted-foreground lg:inline-flex">
							<User {...iconProps} />
							<Skeleton className="h-4 w-28" />
						</div>

						<div className="hidden items-center gap-1.5 font-medium text-muted-foreground lg:inline-flex">
							<Clock {...iconProps} />
							<Skeleton className="h-4 w-40" />
						</div>

						<span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground">
							<FolderPlus {...iconProps} />
						</span>
						<Pencil {...iconProps} />
					</div>
				</div>
			</div>
			<SkeletonContentSection />
		</div>
	);
}
