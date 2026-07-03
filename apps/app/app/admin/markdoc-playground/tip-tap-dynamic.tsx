"use client";

import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import dynamic from "next/dynamic";

// TipTap pulls in the full @tiptap + slash-tiptap + markdoc-md editor stack
// (~90KB+). Load it on demand so the playground paints without shipping that
// bundle in its initial JS.
const TipTap = dynamic(
	async () => {
		const mod = await import("@repo/design-system/components/editor/tip-tap");
		return mod.default;
	},
	{
		loading: () => <Skeleton className="h-full w-full" />,
		ssr: false,
	}
);

export default TipTap;
