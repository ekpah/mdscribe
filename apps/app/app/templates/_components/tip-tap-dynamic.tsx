"use client";

import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import dynamic from "next/dynamic";

// Load the reusable editor on demand so routes embedding it do not ship the
// TipTap and Markdoc stack in their initial JavaScript.
const TipTap = dynamic(
	async () => {
		// The app's tags register before the editor creates its extensions.
		const [mod] = await Promise.all([
			import("markdoc-md-editor/tip-tap"),
			import("@/features/template-tags/editor/plugin"),
		]);
		return mod.default;
	},
	{
		loading: () => <Skeleton className="h-full w-full" />,
		ssr: false,
	},
);

export default TipTap;
