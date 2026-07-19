"use client";

import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import dynamic from "next/dynamic";

// Recharts is heavy and only needed on this admin chart. Load it on demand so
// the usage dashboard paints without waiting on the charting bundle.
export const UsageTrendChart = dynamic(
	async () => {
		const mod = await import("./usage-trend-chart");
		return mod.UsageTrendChart;
	},
	{
		loading: () => <Skeleton className="h-[320px] w-full" />,
		ssr: false,
	}
);
