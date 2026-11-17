"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { ChevronDown, Copy, Download } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { ExchangeFormatError } from "@/lib/template-exchange";

const toBlob = async (text: Promise<string>) => new Blob([await text], { type: "text/plain" });

/** Copies text that may still be loading; Safari only allows clipboard writes started by the click. */
const copyText = async (text: Promise<string>) => {
	if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
		await navigator.clipboard.write([new ClipboardItem({ "text/plain": toBlob(text) })]);
		return;
	}
	await navigator.clipboard.writeText(await text);
};

const downloadText = (fileName: string, text: string) => {
	const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
};

const toFileName = (title: string) =>
	`${
		title
			.normalize("NFKD")
			.replaceAll(/[\u0300-\u036F]/g, "")
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, "-")
			.replaceAll(/^-|-$/g, "") || "vorlage"
	}.md`;

const reportError = (error: unknown) => {
	console.error("Error exporting template:", error);
	toast.error(error instanceof ExchangeFormatError ? error.message : "Kopieren fehlgeschlagen");
};

/**
 * The "Vorlage kopieren" split button: one click copies the exchange text, the menu also
 * offers it as a file download for installations that cannot share a clipboard.
 */
export const CopyTemplateMenu = ({
	label,
	loadText,
	size = "sm",
	successMessage,
	title,
}: {
	label: string;
	loadText: () => Promise<string>;
	/** Match the neighbouring buttons: "sm" on template pages, "default" in the library header. */
	size?: "sm" | "default";
	successMessage: string;
	title: string;
}) => {
	const handleCopy = useCallback(async () => {
		try {
			await copyText(loadText());
			toast.success(successMessage, {
				description: "In einer anderen mdscribe-Installation unter Vorlagen mit Strg+V einfügen.",
			});
		} catch (error) {
			reportError(error);
		}
	}, [loadText, successMessage]);

	const handleDownload = useCallback(async () => {
		try {
			downloadText(toFileName(title), await loadText());
		} catch (error) {
			reportError(error);
		}
	}, [loadText, title]);

	return (
		<div className="inline-flex">
			<Button className="rounded-r-none" onClick={handleCopy} size={size} variant="outline">
				<Copy className="h-4 w-4" />
				<span className="max-sm:sr-only">{label}</span>
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							aria-label={`Weitere Optionen: ${label}`}
							className="-ml-px rounded-l-none"
							size={size === "sm" ? "icon-sm" : "icon"}
							variant="outline"
						>
							<ChevronDown className="h-4 w-4" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem onClick={handleCopy}>
						<Copy className="h-4 w-4" />
						{label}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handleDownload}>
						<Download className="h-4 w-4" />
						Herunterladen
						<span className="ml-auto text-muted-foreground text-xs">.md</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
