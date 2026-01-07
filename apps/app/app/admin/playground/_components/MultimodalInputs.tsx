"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import {
	AudioLines,
	FileText,
	ImageIcon,
	Mic,
	Square,
	Upload,
	X,
} from "lucide-react";
import { useRef } from "react";
import type {
	AudioFile,
	DocumentFile,
	ImageFile,
	ModelCapabilities,
} from "../_lib/types";

interface MultimodalInputsProps {
	capabilities: ModelCapabilities | undefined;
	audioFiles: AudioFile[];
	imageFiles: ImageFile[];
	documentFiles: DocumentFile[];
	isRecording: boolean;
	disabled?: boolean;
	onStartRecording: () => void;
	onStopRecording: () => void;
	onRemoveAudio: (id: string) => void;
	onAddImages: (files: FileList | File[]) => void;
	onRemoveImage: (id: string) => void;
	onAddDocuments: (files: FileList | File[]) => void;
	onRemoveDocument: (id: string) => void;
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MultimodalInputs({
	capabilities,
	audioFiles,
	imageFiles,
	documentFiles,
	isRecording,
	disabled,
	onStartRecording,
	onStopRecording,
	onRemoveAudio,
	onAddImages,
	onRemoveImage,
	onAddDocuments,
	onRemoveDocument,
}: MultimodalInputsProps) {
	const imageInputRef = useRef<HTMLInputElement>(null);
	const documentInputRef = useRef<HTMLInputElement>(null);

	const supportsAudio = capabilities?.supportsAudio ?? false;
	const supportsImage = capabilities?.supportsImage ?? false;
	// Documents are supported by Claude and Gemini models primarily
	const supportsDocuments = true; // Most models support text extraction from documents

	return (
		<div className="space-y-3">
			{/* Input Buttons */}
			<div className="flex flex-wrap gap-2">
				{/* Audio Recording */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={isRecording ? onStopRecording : onStartRecording}
							disabled={disabled || !supportsAudio}
							className={cn(
								"gap-2 border-solarized-base2",
								isRecording && "bg-solarized-red text-solarized-base3",
								!supportsAudio && "cursor-not-allowed opacity-50",
							)}
						>
							{isRecording ? (
								<>
									<Square className="h-4 w-4" />
									Stopp
								</>
							) : (
								<>
									<Mic className="h-4 w-4" />
									Audio
								</>
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						{supportsAudio
							? "Audio aufnehmen (wird an das Modell gesendet)"
							: "Dieses Modell unterstützt keine Audio-Eingabe"}
					</TooltipContent>
				</Tooltip>

				{/* Image Upload */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => imageInputRef.current?.click()}
							disabled={disabled || !supportsImage}
							className={cn(
								"gap-2 border-solarized-base2",
								!supportsImage && "cursor-not-allowed opacity-50",
							)}
						>
							<ImageIcon className="h-4 w-4" />
							Bild
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						{supportsImage
							? "Bilder hochladen"
							: "Dieses Modell unterstützt keine Bild-Eingabe"}
					</TooltipContent>
				</Tooltip>

				{/* Document Upload */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => documentInputRef.current?.click()}
							disabled={disabled || !supportsDocuments}
							className={cn(
								"gap-2 border-solarized-base2",
								!supportsDocuments && "cursor-not-allowed opacity-50",
							)}
						>
							<FileText className="h-4 w-4" />
							Dokument
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						{supportsDocuments
							? "PDF oder Textdokument hochladen"
							: "Dieses Modell unterstützt keine Dokument-Eingabe"}
					</TooltipContent>
				</Tooltip>

				{/* Hidden file inputs */}
				<input
					ref={imageInputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={(e) => {
						if (e.target.files) {
							onAddImages(e.target.files);
							e.target.value = "";
						}
					}}
				/>
				<input
					ref={documentInputRef}
					type="file"
					accept=".pdf,.txt,.doc,.docx"
					multiple
					className="hidden"
					onChange={(e) => {
						if (e.target.files) {
							onAddDocuments(e.target.files);
							e.target.value = "";
						}
					}}
				/>
			</div>

			{/* Attached Files Display */}
			{(audioFiles.length > 0 ||
				imageFiles.length > 0 ||
				documentFiles.length > 0) && (
				<div className="space-y-2">
					{/* Audio Files */}
					{audioFiles.map((audio, index) => (
						<div
							key={audio.id}
							className="flex items-center justify-between rounded-lg border border-solarized-green/30 bg-solarized-green/10 px-3 py-2"
						>
							<div className="flex items-center gap-2 text-sm text-solarized-green">
								<AudioLines className="h-4 w-4" />
								<span>
									Aufnahme {index + 1} ({formatDuration(audio.duration)})
								</span>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-6 w-6 text-solarized-base01 hover:text-solarized-red"
								onClick={() => onRemoveAudio(audio.id)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					))}

					{/* Image Files */}
					{imageFiles.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{imageFiles.map((img) => (
								<div
									key={img.id}
									className="group relative h-16 w-16 overflow-hidden rounded-lg border border-solarized-blue/30"
								>
									<img
										src={img.url}
										alt={img.filename}
										className="h-full w-full object-cover"
									/>
									<Button
										type="button"
										variant="destructive"
										size="icon"
										className="absolute -right-1 -top-1 h-5 w-5 opacity-0 group-hover:opacity-100"
										onClick={() => onRemoveImage(img.id)}
									>
										<X className="h-3 w-3" />
									</Button>
								</div>
							))}
						</div>
					)}

					{/* Document Files */}
					{documentFiles.map((doc) => (
						<div
							key={doc.id}
							className="flex items-center justify-between rounded-lg border border-solarized-cyan/30 bg-solarized-cyan/10 px-3 py-2"
						>
							<div className="flex items-center gap-2 text-sm text-solarized-cyan">
								<FileText className="h-4 w-4" />
								<span className="max-w-[200px] truncate">{doc.filename}</span>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-6 w-6 text-solarized-base01 hover:text-solarized-red"
								onClick={() => onRemoveDocument(doc.id)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					))}
				</div>
			)}

			{/* Capability Indicators */}
			{capabilities && (
				<div className="flex flex-wrap gap-1.5 text-xs text-solarized-base01">
					<span
						className={cn(
							"flex items-center gap-1 rounded px-1.5 py-0.5",
							supportsImage
								? "bg-solarized-blue/10 text-solarized-blue"
								: "bg-solarized-base2/50 line-through",
						)}
					>
						<ImageIcon className="h-3 w-3" />
						Bild
					</span>
					<span
						className={cn(
							"flex items-center gap-1 rounded px-1.5 py-0.5",
							supportsAudio
								? "bg-solarized-green/10 text-solarized-green"
								: "bg-solarized-base2/50 line-through",
						)}
					>
						<AudioLines className="h-3 w-3" />
						Audio
					</span>
					<span
						className={cn(
							"flex items-center gap-1 rounded px-1.5 py-0.5",
							supportsDocuments
								? "bg-solarized-cyan/10 text-solarized-cyan"
								: "bg-solarized-base2/50 line-through",
						)}
					>
						<FileText className="h-3 w-3" />
						PDF
					</span>
				</div>
			)}
		</div>
	);
}
