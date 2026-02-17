"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { X } from "lucide-react";
import { useCallback } from "react";
import { Button } from "../../../../ui/button";
import { Input } from "../../../../ui/input";
import { Label } from "../../../../ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "../../../../ui/popover";

export function CaseTagView({
	node,
	editor,
	updateAttributes,
	getPos,
	deleteNode,
	selected,
}: NodeViewProps) {
	const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		updateAttributes({ primary: e.target.value });
	};

	const handleRemoveCase = useCallback(() => {
		deleteNode();
	}, [deleteNode]);

	const handleContentDoubleClick = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();

		// Allow text selection within the content area
		const target = e.currentTarget as HTMLElement;
		const range = document.createRange();
		const selection = window.getSelection();

		if (selection && target.firstChild) {
			range.selectNodeContents(target);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}, []);

	return (
		<NodeViewWrapper
			as="span"
			className="inline-block align-baseline mx-1"
		>
			<div
				className={`group inline-flex items-center gap-1 rounded-md border px-1 py-0.5 text-xs shadow-xs transition-all ${
					selected
						? "border-solarized-blue ring-2 ring-solarized-blue/40"
						: "border-solarized-blue/50 hover:border-solarized-blue"
				}`}
			>
				<Popover>
					<PopoverTrigger
						className="inline-flex cursor-pointer items-center gap-1.5 px-1 py-0.5"
						contentEditable={false}
					>
						<span
							data-drag-handle
							className="inline-flex items-center gap-1 rounded bg-solarized-blue/15 px-1.5 py-0.5 font-semibold text-solarized-blue"
						>
							Case
						</span>
						<span className="font-mono text-foreground/80">
							{node.attrs.primary || "default"}
						</span>
					</PopoverTrigger>
					<PopoverContent
						collisionPadding={12}
						className="w-[min(320px,94vw)] max-h-[min(70vh,var(--radix-popover-content-available-height))] overflow-hidden p-0"
					>
						<div className="flex max-h-[min(70vh,var(--radix-popover-content-available-height))] flex-col">
							<div className="shrink-0 border-b bg-solarized-blue/5 px-3 py-2">
								<h3 className="font-medium text-solarized-blue text-sm">
									Case-Konfiguration
								</h3>
							</div>
							<div className="min-h-0 flex-1 overflow-y-auto">
								<div className="space-y-3 p-3">
									<div className="space-y-1.5">
										<Label htmlFor="primary" className="font-medium text-xs">
											Case Key
										</Label>
										<Input
											id="primary"
											value={node.attrs.primary}
											onChange={handlePrimaryChange}
											className="h-8 text-sm focus:border-solarized-blue focus:ring-solarized-blue/50"
											placeholder="Enter case key"
											autoFocus
										/>
									</div>
								</div>
							</div>
						</div>
					</PopoverContent>
				</Popover>

				<NodeViewContent
					className="whitespace-nowrap px-1 text-foreground/80"
					onDoubleClick={handleContentDoubleClick}
				/>

				<Button
					variant="ghost"
					size="icon"
					onClick={handleRemoveCase}
					className="remove-case-btn-inline h-6 w-6 rounded-sm text-solarized-blue/70 hover:bg-solarized-blue/10 hover:text-solarized-blue"
					contentEditable={false}
					aria-label="Remove case"
				>
					<X className="h-3 w-3" />
				</Button>
			</div>
		</NodeViewWrapper>
	);
}
