"use client";

import { AlertCircleIcon, UploadIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
	formatBytes,
	useFileUpload,
} from "../../hooks/use-file-upload";
import { cn } from "../../lib/utils";

type FileDropzoneFile = {
	file: unknown;
	id: string;
	preview?: string;
};

type FileDropzoneProps = {
	accept?: string;
	"aria-label"?: string;
	className?: string;
	description?: ReactNode;
	disabled?: boolean;
	disableAfterSelection?: boolean;
	errorClassName?: string;
	icon?: ReactNode;
	maxFiles?: number;
	maxSize?: number;
	multiple?: boolean;
	onFilesAdded?: (files: FileDropzoneFile[]) => void;
	title: ReactNode;
	variant?: "default" | "compact";
};

export const FileDropzone = ({
	accept,
	"aria-label": ariaLabel = "Datei hochladen",
	className,
	description,
	disabled = false,
	disableAfterSelection = false,
	errorClassName,
	icon,
	maxFiles,
	maxSize,
	multiple = false,
	onFilesAdded,
	title,
	variant = "default",
}: FileDropzoneProps) => {
	const [
		{ errors, files, isDragging },
		{
			getInputProps,
			handleDragEnter,
			handleDragLeave,
			handleDragOver,
			handleDrop,
			openFileDialog,
		},
	] = useFileUpload({
		accept,
		maxFiles,
		maxSize,
		multiple,
		onFilesAdded,
	});
	const isDisabled = disabled || (disableAfterSelection && files.length > 0);

	return (
		<div className="flex flex-col gap-2">
			<button
				className={cn(
					"flex flex-col items-center justify-center border border-input border-dashed bg-background text-center transition-colors hover:bg-accent/50 has-disabled:pointer-events-none has-[input:focus]:border-ring has-disabled:opacity-50 has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50",
					variant === "default"
						? "min-h-40 rounded-xl p-4"
						: "min-h-32 gap-2 rounded-md p-4 text-muted-foreground text-xs",
					className,
				)}
				data-dragging={isDragging || undefined}
				disabled={isDisabled}
				onClick={openFileDialog}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				type="button"
			>
				<input
					{...getInputProps()}
					aria-label={ariaLabel}
					className="sr-only"
					disabled={isDisabled}
				/>

				{variant === "default" ? (
					<div className="flex flex-col items-center justify-center text-center">
						<div
							aria-hidden="true"
							className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
						>
							{icon ?? <UploadIcon className="size-4 opacity-60" />}
						</div>
						<p className="mb-1.5 font-medium text-sm">{title}</p>
						{description ? (
							<p className="text-muted-foreground text-xs">{description}</p>
						) : null}
					</div>
				) : (
					<>
						{icon ?? <UploadIcon className="h-5 w-5" />}
						<span>{title}</span>
						{description ? <span>{description}</span> : null}
					</>
				)}
			</button>

			{errors.length > 0 ? (
				<div
					className={cn(
						"flex items-center gap-1 text-destructive text-xs",
						errorClassName,
					)}
					role="alert"
				>
					<AlertCircleIcon className="size-3 shrink-0" />
					<span>{errors[0]}</span>
				</div>
			) : null}
		</div>
	);
};

export { formatBytes };
