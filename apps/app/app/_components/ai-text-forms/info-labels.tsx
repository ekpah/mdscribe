"use client";

import { Label } from "@repo/design-system/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/design-system/components/ui/tooltip";
import { Info } from "lucide-react";

const InfoHint = ({ text }: { text: string }) => (
	<Tooltip>
		<TooltipTrigger render={<button
				aria-label={text}
				className="inline-flex h-4 w-4 items-center justify-center rounded-full text-solarized-base01 transition-colors hover:text-solarized-base00"
				type="button"
			>
				<Info className="h-3.5 w-3.5" />
			</button>} />
		<TooltipContent className="max-w-64 text-xs leading-relaxed">{text}</TooltipContent>
	</Tooltip>
);

export const LabelWithInfo = ({
	children,
	htmlFor,
	info,
}: {
	children: string;
	htmlFor?: string;
	info: string;
}) => (
	<div className="flex items-center gap-1.5">
		<Label htmlFor={htmlFor}>{children}</Label>
		<InfoHint text={info} />
	</div>
);

export const SectionLabelWithInfo = ({
	children,
	info,
}: {
	children: string;
	info: string;
}) => (
	<div className="flex items-center gap-1.5">
		<span className="font-medium">{children}</span>
		<InfoHint text={info} />
	</div>
);
