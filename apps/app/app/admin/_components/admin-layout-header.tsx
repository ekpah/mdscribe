"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { RefreshCw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { AdminBreadcrumb } from "./admin-breadcrumb";

const REFRESHABLE_ADMIN_PATHS = [
	"/admin/settings",
	"/admin/templates",
	"/admin/usage",
	"/admin/users",
] as const;

export const AdminLayoutHeader = () => {
	const pathname = usePathname();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const showRefresh = REFRESHABLE_ADMIN_PATHS.some((path) =>
		pathname.startsWith(path),
	);

	const handleRefresh = () => {
		startTransition(() => {
			router.refresh();
		});
	};

		return (
		<div className="shrink-0 bg-solarized-base2 px-4 py-1.5">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<AdminBreadcrumb />
				{showRefresh ? (
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isPending}
						className="w-full sm:w-auto"
					>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`}
						/>
						<span className="hidden sm:inline">Aktualisieren</span>
					</Button>
				) : null}
			</div>
		</div>
	);
};
