"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface ContextTemplateCardTemplate {
	title: string;
	/** Optional link to the template detail page. */
	href?: string;
}

interface ContextTemplateCardProps {
	/** Header title. Defaults to "Kontext & Vorlage". */
	title?: string;
	/** The template driving the generation. Renders as a link when `href` is set. */
	template?: ContextTemplateCardTemplate;
	/** The prompt harness used for the generation. */
	prompt?: ReactNode;
	/** The author of the template/prompt. */
	author?: ReactNode;
	/** Shown inside the metadata box when no template/prompt/author is provided. */
	emptyLabel?: string;
	/** Optional green info box rendered below the metadata. */
	note?: ReactNode;
	/** Optional red privacy/warning box rendered at the bottom. */
	warning?: ReactNode;
	/** Compact spacing for narrow placements (e.g. beside a field). */
	compact?: boolean;
	className?: string;
}

const MetadataRow = ({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) => (
	<div className="grid gap-1">
		<div className="font-medium text-muted-foreground text-xs">{label}</div>
		<div className="break-words text-foreground text-sm">{children}</div>
	</div>
);

const TemplateValue = ({ template }: { template: ContextTemplateCardTemplate }) =>
	template.href ? (
		<Link
			className="inline-flex items-center gap-1 font-medium text-solarized-blue transition hover:text-solarized-blue/80"
			href={template.href}
			rel="noreferrer"
			target="_blank"
		>
			<span className="break-words">{template.title}</span>
			<ExternalLink className="h-3.5 w-3.5 shrink-0" />
		</Link>
	) : (
		<span className="break-words">{template.title}</span>
	);

/**
 * "Kontext & Vorlage" card. Shows which template and prompt drive a generation.
 *
 * Shared between the production AIScribe pages and the doctor's-note editor so
 * the metadata UI stays identical — pass in the template, prompt and author.
 */
export const ContextTemplateCard = ({
	title = "Kontext & Vorlage",
	template,
	prompt,
	author,
	emptyLabel,
	note,
	warning,
	compact = false,
	className,
}: ContextTemplateCardProps) => {
	const hasMetadata = Boolean(template || prompt || author);

	return (
		<Card className={cn("h-fit border-solarized-blue/20 shadow-lg", className)}>
			<CardHeader className="bg-gradient-to-r from-solarized-blue/5 to-solarized-green/5">
				<div className="flex items-center gap-2">
					<div className="h-2 w-2 rounded-full bg-solarized-blue" />
					<CardTitle className="text-base text-foreground">{title}</CardTitle>
				</div>
			</CardHeader>
			<CardContent className={cn("space-y-6", compact ? "p-4" : "p-6")}>
				{(hasMetadata || emptyLabel) && (
					<div className="rounded-lg border border-muted-foreground/20 border-dashed bg-muted/20 p-4">
						{hasMetadata ? (
							<div className={cn(compact ? "space-y-4" : "space-y-5")}>
								{template && (
									<MetadataRow label="Template">
										<TemplateValue template={template} />
									</MetadataRow>
								)}
								{prompt && <MetadataRow label="Prompt">{prompt}</MetadataRow>}
								{author && <MetadataRow label="Autor">{author}</MetadataRow>}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">{emptyLabel}</p>
						)}
					</div>
				)}

				{note && (
					<div className="rounded-lg border border-solarized-green/20 bg-solarized-green/10 p-4 text-xs">
						<p className="text-solarized-green leading-relaxed">{note}</p>
					</div>
				)}

				{warning && (
					<div className="rounded-lg border border-solarized-red/20 bg-solarized-red/10 p-4 text-xs">
						<p className="text-solarized-red leading-relaxed">{warning}</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
