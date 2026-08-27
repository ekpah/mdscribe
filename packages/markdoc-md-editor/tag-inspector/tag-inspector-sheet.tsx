"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { cn } from "@repo/design-system/lib/utils";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

import { TAG_PANEL_META, TagPanelBody } from "./tag-inspector";
import { useSelectedMarkdocTag } from "./use-selected-markdoc-tag";

const useIsBelowViewportWidth = (width: number | null): boolean => {
	const [isBelow, setIsBelow] = useState(false);

	useEffect(() => {
		if (width === null) {
			setIsBelow(true);
			return;
		}

		const mediaQueryList = window.matchMedia(`(max-width: ${width - 1}px)`);
		const handleChange = () => {
			setIsBelow(mediaQueryList.matches);
		};

		handleChange();
		mediaQueryList.addEventListener("change", handleChange);

		return () => {
			mediaQueryList.removeEventListener("change", handleChange);
		};
	}, [width]);

	return isBelow;
};

/**
 * Bottom-sheet variant of the tag inspector for viewports where the sidebar
 * is hidden. Opens when a tag node is selected via chip click and closes by
 * collapsing the selection.
 */
export const TagInspectorSheet = ({
	editor,
	maxViewportWidth = 1280,
}: {
	editor: Editor | null;
	/**
	 * Only open the sheet below this viewport width (px). Defaults to 1280 to
	 * match the `xl` breakpoint of the sidebar. Pass null to always use the
	 * sheet regardless of viewport size.
	 */
	maxViewportWidth?: number | null;
}) => {
	const { clearSelectedTag, selectedTag } = useSelectedMarkdocTag(editor);
	const isSheetViewport = useIsBelowViewportWidth(maxViewportWidth);

	// Only chip clicks open the sheet; a text cursor inside case content must
	// not cover the editor while the user types inline.
	const open = Boolean(editor && selectedTag && selectedTag.via === "node" && isSheetViewport);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				clearSelectedTag();
			}
		},
		[clearSelectedTag],
	);

	if (!(editor && selectedTag)) {
		return null;
	}

	const meta = TAG_PANEL_META[selectedTag.kind];

	return (
		<Sheet onOpenChange={handleOpenChange} open={open}>
			<SheetContent className="max-h-[85dvh] overflow-y-auto rounded-t-xl p-4" side="bottom">
				<SheetHeader className="pb-3 text-left">
					<SheetTitle className="flex items-center gap-2.5 text-base">
						<span
							className={cn(
								"flex h-7 w-7 items-center justify-center rounded-sm",
								meta.iconWrapClassName,
							)}
						>
							<meta.icon className={cn("h-4 w-4", meta.iconClassName)} />
						</span>
						{meta.label}-Tag bearbeiten
					</SheetTitle>
				</SheetHeader>
				<TagPanelBody
					editor={editor}
					key={`${selectedTag.kind}-${selectedTag.pos}`}
					selectedTag={selectedTag}
				/>
			</SheetContent>
		</Sheet>
	);
};
