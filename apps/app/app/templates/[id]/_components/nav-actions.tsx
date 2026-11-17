"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Clock, Copy, Lock, Pencil, Sparkles, User } from "lucide-react";
import Link from "next/link";

import { CopyTemplateMenu } from "@/app/templates/_components/copy-template-menu";
import { serializeTemplate } from "@/lib/template-exchange";
import type { ExchangeTemplate } from "@/lib/template-exchange";

export interface NavActionsProps {
	author?: string;
	exportTemplate: ExchangeTemplate;
	isAuthor: boolean;
	isLoggedIn: boolean;
	lastEdited: Date;
	templateId: string;
	visibility?: "public" | "private";
}

export const NavActions = ({
	author,
	exportTemplate,
	isAuthor,
	isLoggedIn,
	lastEdited,
	templateId,
	visibility,
}: NavActionsProps) => (
	<div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
		{visibility === "private" && <Lock className="size-4" aria-label="Private Vorlage" />}
		<span className="hidden items-center gap-1 lg:inline-flex">
			<User className="size-4" />
			{author || "Anonym"}
		</span>
		<span className="hidden items-center gap-1 xl:inline-flex">
			<Clock className="size-4" />
			{new Date(lastEdited).toLocaleDateString("de-DE")}
		</span>
		<CopyTemplateMenu
			label="Vorlage kopieren"
			loadText={() => Promise.resolve(serializeTemplate(exportTemplate))}
			successMessage="Vorlage kopiert"
			title={exportTemplate.title}
		/>
		{isLoggedIn && (
			// The case entered here stays in the shared case state and opens with AI Scribe.
			<Button size="sm" render={<Link href={`/aiscribe/${templateId}`} />}>
				<Sparkles className="size-4" />
				<span className="max-sm:sr-only">Mit KI ausfüllen</span>
			</Button>
		)}
		{isLoggedIn && (
			<Button
				variant="ghost"
				size="icon"
				aria-label={isAuthor ? "Vorlage bearbeiten" : "Vorlage kopieren und bearbeiten"}
				render={
					<Link
						href={
							isAuthor ? `/templates/${templateId}/edit` : `/templates/create?fork=${templateId}`
						}
					/>
				}
			>
				{isAuthor ? <Pencil className="size-4" /> : <Copy className="size-4" />}
			</Button>
		)}
	</div>
);
