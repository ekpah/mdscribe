"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { FileDropzone } from "@repo/design-system/components/ui/file-dropzone";
import { cn } from "@repo/design-system/lib/utils";
import { Paperclip, X } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
} from "@/lib/input-fill-limits";
import type { UploadedContextFile } from "../../types";

interface DocumentInputProps {
	className?: string;
	disabled?: boolean;
	dropzoneClassName?: string;
	emptyClassName?: string;
	emptyLabel?: string;
	itemClassName?: string;
	listClassName?: string;
	maxFileBytes?: number;
	maxFiles?: number;
	maxTotalBytes?: number;
	onValueChange: (files: UploadedContextFile[]) => void;
	value: UploadedContextFile[];
}

const getContextFilesTotalSize = (files: UploadedContextFile[]): number => {
	let total = 0;
	for (const { file } of files) {
		total += file.size;
	}
	return total;
};

const createUploadedContextFile = (file: File): UploadedContextFile => ({
	file,
	id: `file-${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
});

export const DocumentInput = ({
	className,
	disabled = false,
	dropzoneClassName,
	emptyClassName,
	emptyLabel = "Noch keine Datei hinzugefügt.",
	itemClassName,
	listClassName,
	maxFileBytes = FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes,
	maxFiles = FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles,
	maxTotalBytes = FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes,
	onValueChange,
	value,
}: DocumentInputProps) => {
	const handleAddFiles = useCallback(
		(files: { file: unknown }[]) => {
			if (disabled) {
				return;
			}

			const nextFiles = files
				.map(({ file }) => file)
				.filter((file): file is File => file instanceof File);
			if (nextFiles.length === 0) {
				return;
			}

			if (value.length + nextFiles.length > maxFiles) {
				toast.error(`Maximal ${maxFiles} Dateien möglich.`);
				return;
			}

			for (const file of nextFiles) {
				if (file.size > maxFileBytes) {
					toast.error(
						`"${file.name}" ist zu groß. Maximal ${formatPayloadBytes(maxFileBytes)} pro Datei.`,
					);
					return;
				}
			}

			const nextTotalSize =
				getContextFilesTotalSize(value) +
				nextFiles.reduce((sum, file) => sum + file.size, 0);
			if (nextTotalSize > maxTotalBytes) {
				toast.error(
					`Dateien sind zusammen zu groß. Maximal ${formatPayloadBytes(maxTotalBytes)} möglich.`,
				);
				return;
			}

			onValueChange([...value, ...nextFiles.map(createUploadedContextFile)]);
		},
		[disabled, maxFileBytes, maxFiles, maxTotalBytes, onValueChange, value],
	);

	const handleRemoveFile = useCallback(
		(id: string) => {
			onValueChange(value.filter((contextFile) => contextFile.id !== id));
		},
		[onValueChange, value],
	);

	return (
		<div
			className={cn(
				"flex min-h-0 flex-col gap-4",
				disabled && "opacity-70",
				className,
			)}
		>
			<FileDropzone
				className={cn(
					"hover:border-solarized-blue data-[dragging=true]:border-solarized-blue data-[dragging=true]:bg-solarized-blue/10",
					disabled && "pointer-events-none",
					dropzoneClassName,
				)}
				description={`Max. ${maxFiles} Dateien, ${formatPayloadBytes(maxFileBytes)} je Datei`}
				multiple
				onFilesAdded={handleAddFiles}
				title="Dateien hier ablegen oder auswählen"
				variant="compact"
			/>
			<div className={cn("grid gap-2 overflow-y-auto", listClassName)}>
				{value.length > 0 ? (
					value.map(({ file, id }) => (
						<div
							className={cn(
								"flex min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5",
								itemClassName,
							)}
							key={id}
						>
							<div className="flex min-w-0 items-center gap-2 text-xs">
								<Paperclip className="h-3.5 w-3.5 shrink-0 text-solarized-blue" />
								<span className="truncate">{file.name}</span>
								<span className="shrink-0 text-muted-foreground">
									{Math.ceil(file.size / 1024)} KB
								</span>
							</div>
							<Button
								aria-label="Datei entfernen"
								className="h-7 w-7 shrink-0"
								disabled={disabled}
								onClick={() => {
									handleRemoveFile(id);
								}}
								size="icon"
								type="button"
								variant="ghost"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					))
				) : (
					<div
						className={cn(
							"rounded-md border border-dashed bg-background p-4 text-muted-foreground text-xs",
							emptyClassName,
						)}
					>
						{emptyLabel}
					</div>
				)}
			</div>
		</div>
	);
};
