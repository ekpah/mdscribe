"use client";

import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import dynamic from "next/dynamic";

// The tag inspector shares the @tiptap/pm + fparser stack with the editor.
// Load it on demand like TipTap so editor routes keep a light initial bundle.
export const TagInspector = dynamic(
	async () => {
		const mod = await import("markdoc-md-editor/tag-inspector/tag-inspector");
		return mod.TagInspector;
	},
	{
		loading: () => <Skeleton className="h-full w-full" />,
		ssr: false,
	},
);

export const TagInspectorSheet = dynamic(
	async () => {
		const mod = await import("markdoc-md-editor/tag-inspector/tag-inspector-sheet");
		return mod.TagInspectorSheet;
	},
	{ ssr: false },
);
