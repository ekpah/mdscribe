"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import type { NodeViewProps } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useCallback } from "react";

type TagChipColor = "blue" | "cyan" | "green" | "orange";

const CHIP_COLOR_CLASSES: Record<
	TagChipColor,
	{ chip: string; label: string; remove: string; selectedChip: string }
> = {
	blue: {
		chip: "border-solarized-blue/50 hover:border-solarized-blue hover:bg-solarized-blue/5",
		label: "bg-solarized-blue/15 text-solarized-blue",
		remove: "text-solarized-blue/70 hover:bg-solarized-blue/10 hover:text-solarized-blue",
		selectedChip: "border-solarized-blue bg-solarized-blue/10 ring-2 ring-solarized-blue/35",
	},
	cyan: {
		chip: "border-solarized-cyan/50 hover:border-solarized-cyan hover:bg-solarized-cyan/5",
		label: "bg-solarized-cyan/15 text-solarized-cyan",
		remove: "text-solarized-cyan/70 hover:bg-solarized-cyan/10 hover:text-solarized-cyan",
		selectedChip: "border-solarized-cyan bg-solarized-cyan/10 ring-2 ring-solarized-cyan/35",
	},
	green: {
		chip: "border-solarized-green/50 hover:border-solarized-green hover:bg-solarized-green/5",
		label: "bg-solarized-green/15 text-solarized-green",
		remove: "text-solarized-green/70 hover:bg-solarized-green/10 hover:text-solarized-green",
		selectedChip: "border-solarized-green bg-solarized-green/10 ring-2 ring-solarized-green/35",
	},
	orange: {
		chip: "border-solarized-orange/50 hover:border-solarized-orange hover:bg-solarized-orange/5",
		label: "bg-solarized-orange/15 text-solarized-orange",
		remove: "text-solarized-orange/70 hover:bg-solarized-orange/10 hover:text-solarized-orange",
		selectedChip: "border-solarized-orange bg-solarized-orange/10 ring-2 ring-solarized-orange/35",
	},
};

/**
 * Selects the node view's node in the editor, which surfaces its properties
 * in the tag inspector sidebar/sheet.
 */
export const useSelectTagNode = ({
	editor,
	getPos,
}: Pick<NodeViewProps, "editor" | "getPos">) =>
	useCallback(() => {
		const pos = getPos?.();
		if (typeof pos === "number") {
			editor.chain().focus().setNodeSelection(pos).run();
		}
	}, [editor, getPos]);

export const TagChip = ({
	children,
	color,
	dataType,
	icon: Icon,
	label,
	onRemove,
	onSelect,
	removeLabel,
	selected,
	summary,
}: {
	/** Extra inline content outside the select trigger (e.g. editable case content). */
	children?: ReactNode;
	color: TagChipColor;
	dataType: string;
	icon?: LucideIcon;
	label: string;
	onRemove: () => void;
	onSelect: () => void;
	removeLabel: string;
	selected: boolean;
	/** Compact value preview rendered next to the label. */
	summary?: ReactNode;
}) => {
	const colorClasses = CHIP_COLOR_CLASSES[color];

	const handleMouseDown = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			// Keep focus in the editor so the node selection stays active/visible.
			event.preventDefault();
			onSelect();
		},
		[onSelect],
	);

	return (
		<span
			className={cn(
				"group inline-flex items-center gap-0.5 rounded-sm border px-1 py-0 text-[11px] leading-none shadow-xs transition-all",
				selected ? colorClasses.selectedChip : colorClasses.chip,
			)}
		>
			<button
				className="inline-flex h-[18px] cursor-pointer items-center gap-1 px-0.5 py-0 leading-none"
				contentEditable={false}
				data-type={dataType}
				onMouseDown={handleMouseDown}
				type="button"
			>
				<span
					className={cn(
						"inline-flex h-[16px] items-center gap-0.5 rounded-xs px-1 py-0 font-semibold leading-none",
						colorClasses.label,
					)}
				>
					{Icon ? <Icon className="h-2.5 w-2.5" /> : null}
					{label}
				</span>
				{summary}
			</button>

			{children}

			<Button
				aria-label={removeLabel}
				className={cn("h-4 w-4 rounded-xs", colorClasses.remove)}
				contentEditable={false}
				onClick={onRemove}
				size="icon"
				variant="ghost"
			>
				<X className="h-2.5 w-2.5" />
			</Button>
		</span>
	);
};
