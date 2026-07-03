"use client";

import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import dynamic from "next/dynamic";

// TipTap pulls in the full @tiptap + slash-tiptap + markdoc-md editor stack
// (~90KB+). Load it on demand so routes that embed the template editor paint
// without shipping that bundle in their initial JS.
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
