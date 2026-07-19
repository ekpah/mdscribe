"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Clock, File as FileIcon, FileUser, Pencil, Share2, User } from "lucide-react";
import Link from "next/link";

import { getDocumentDetailAction } from "@/app/documents/_lib/document-detail-action";
import { USER_MESSAGES } from "@/lib/user-messages";

export const NavActions = ({
	author,
	documentId,
	isAuthor,
	isLoggedIn,
	lastEdited,
	visibility,
}: {
	author?: string;
	documentId: string;
	isAuthor: boolean;
	isLoggedIn: boolean;
	lastEdited: Date;
	visibility?: "public" | "private";
}) => {
	const actionIconProps = {
		className: "h-4 w-4",
		strokeWidth: 1.5,
	} as const;
	const action = getDocumentDetailAction({ documentId, isAuthor, isLoggedIn });
	const ActionIcon = action?.kind === "edit" ? Pencil : Share2;
	const actionLabel =
		action?.kind === "edit"
			? USER_MESSAGES.documentEditor.editDocument
			: USER_MESSAGES.documentEditor.forkDocument;

	return (
		<div className="flex items-center gap-2 text-sm">
			<TooltipProvider delay={300}>
				<Tooltip>
					<TooltipTrigger render={<span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground">
							{visibility === "private" ? (
								<FileUser className="h-4 w-4" strokeWidth={1.5} />
							) : (
								<FileIcon className="h-4 w-4" strokeWidth={1.5} />
							)}
						</span>} />
					<TooltipContent>
						<p>{visibility === "private" ? "Privat sichtbar" : "Öffentlich sichtbar"}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
				<User />
				Autor: {author || "Anonym"}
			</div>
			<div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
				<Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
				Zuletzt bearbeitet am{" "}
				{new Date(lastEdited).toLocaleString("de-DE", {
					dateStyle: "medium",
				})}
			</div>
			{action ? (
				<TooltipProvider delay={300}>
					<Tooltip>
						<TooltipTrigger
							render={
								<Link href={action.href}>
									<Button
										aria-label={actionLabel}
										className="h-7 w-7"
										size="icon"
										variant="ghost"
									>
										<ActionIcon {...actionIconProps} />
									</Button>
								</Link>
							}
						/>
						<TooltipContent>{actionLabel}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			) : null}
		</div>
	);
};
