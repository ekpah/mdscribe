"use client";

import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import dynamic from "next/dynamic";

// Recharts is heavy and only needed on this admin chart. Load it on demand so
// the dashboard shell paints without waiting on the charting bundle.
export const MonthlyActiveUsersChart = dynamic(
	async () => {
		const mod = await import("./monthly-active-users-chart");
		return mod.MonthlyActiveUsersChart;
	},
	{
		loading: () => <Skeleton className="h-[320px] w-full" />,
		ssr: false,
	}
);
