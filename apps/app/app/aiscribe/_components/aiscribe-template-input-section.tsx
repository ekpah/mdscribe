"use client";

import {
	PromptInput,
	PromptInputActionMenu,
	PromptInputBody,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "@repo/design-system/components/ai-elements/prompt-input";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { Mic, Square, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { ChangeEvent, FormEvent, RefObject } from "react";

interface AiscribeTemplateInputField {
	description?: string;
	label: string;
	name: string;
	placeholder: string;
	required?: boolean;
	type?: "text" | "textarea";
}

interface AiscribeTemplateAudioRecording {
	duration: number;
	id: string;
}

interface AiscribeTemplateInputAudioConfig {
	canRecord: boolean;
	isRecording: boolean;
	isSubmittingRecordings?: boolean;
	onRemoveRecording: (id: string) => void;
	onSubmitRecordings?: () => void | Promise<void>;
	onToggleRecording: () => void;
	recordingButtonTitle: string;
	recordings: AiscribeTemplateAudioRecording[];
	submitRecordingsLabel?: string;
	submitRecordingsPendingLabel?: string;
}

interface AiscribeTemplateInputSectionProps {
	additionalInputData: Record<string, string>;
	additionalInputs?: AiscribeTemplateInputField[];
	audio?: AiscribeTemplateInputAudioConfig;
	inputPlaceholder: string;
	inputValue: string;
	isLoading?: boolean;
	onAdditionalInputChange: (name: string, value: string) => void;
	onInputValueChange: (value: string) => void;
	onSubmit?: () => void | Promise<void>;
	showSubmit?: boolean;
	submitDisabled?: boolean;
	additionalTextareaClassName?: string;
	mainTextareaClassName?: string;
	textareaId?: string;
	textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

const formatDuration = (seconds: number): string => {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const AiscribeTemplateInputSection = ({
	additionalInputData,
	additionalInputs,
	audio,
	inputPlaceholder,
	inputValue,
	isLoading = false,
	onAdditionalInputChange,
	onInputValueChange,
	onSubmit,
	showSubmit = true,
	submitDisabled = false,
	additionalTextareaClassName,
	mainTextareaClassName,
	textareaId = "input-field",
	textareaRef,
}: AiscribeTemplateInputSectionProps) => {
	const additionalInputChangeHandlers = useMemo(() => {
		const handlers: Record<
			string,
			(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
		> = {};
		for (const field of additionalInputs ?? []) {
			handlers[field.name] = (event) => {
				onAdditionalInputChange(field.name, event.target.value);
			};
		}
		return handlers;
	}, [additionalInputs, onAdditionalInputChange]);

	const handlePromptSubmit = useCallback((_: unknown, event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!onSubmit) {
			return;
		}
		void onSubmit();
	}, [onSubmit]);

	const handleAudioRecordingsSubmit = useCallback(() => {
		if (!audio?.onSubmitRecordings) {
			return;
		}
		void audio.onSubmitRecordings();
	}, [audio]);

	const handleToggleRecording = useCallback(() => {
		if (!audio) {
			return;
		}
		audio.onToggleRecording();
	}, [audio]);

	const isAudioToggleDisabled =
		!audio ||
		isLoading ||
		audio.isSubmittingRecordings ||
		!(audio.canRecord || audio.isRecording);

	return (
		<div className="space-y-4">
			{additionalInputs && additionalInputs.length > 0 ? (
				<div className="space-y-4 rounded-lg border border-solarized-blue/20 bg-solarized-blue/5 p-4">
					<div className="flex items-center gap-2">
						<div className="h-1.5 w-1.5 rounded-full bg-solarized-blue" />
						<h4 className="font-medium text-foreground text-sm">
							Zusätzliche Informationen
						</h4>
					</div>
					<div className="grid gap-4">
						{additionalInputs.map((field) => {
							const handleAdditionalInputFieldChange =
								additionalInputChangeHandlers[field.name];
							if (!handleAdditionalInputFieldChange) {
								return null;
							}

							return (
								<div className="space-y-2" key={field.name}>
									<Label className="font-medium text-sm" htmlFor={field.name}>
										{field.label}
										{field.required ? (
											<span className="ml-1 text-red-500">*</span>
										) : null}
									</Label>
									{field.type === "textarea" ? (
										<Textarea
											className={cn(
												"min-h-[180px] resize-y border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20",
												additionalTextareaClassName,
											)}
											disabled={isLoading}
											id={field.name}
											onChange={handleAdditionalInputFieldChange}
											placeholder={field.placeholder}
											value={additionalInputData[field.name] || ""}
										/>
									) : (
										<Input
											className="border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
											disabled={isLoading}
											id={field.name}
											onChange={handleAdditionalInputFieldChange}
											placeholder={field.placeholder}
											value={additionalInputData[field.name] || ""}
										/>
									)}
									{field.description ? (
										<p className="text-muted-foreground text-xs">
											{field.description}
										</p>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
				) : null}
			{audio && audio.recordings.length > 0 ? (
				<div className="space-y-2">
					{audio.recordings.map((recording, index) => (
						<div
							className="rounded-lg border border-solarized-green/20 bg-solarized-green/10 p-3"
							key={recording.id}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-solarized-green">
									<Mic className="h-4 w-4" />
									<span>
										Aufnahme {index + 1} ({formatDuration(recording.duration)})
									</span>
								</div>
								<Button
									onClick={() => {
										audio.onRemoveRecording(recording.id);
									}}
									size="sm"
									type="button"
									variant="ghost"
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						</div>
					))}

					{audio.onSubmitRecordings ? (
						<Button
							className="w-full"
							disabled={audio.recordings.length === 0 || audio.isSubmittingRecordings}
							onClick={handleAudioRecordingsSubmit}
							type="button"
						>
							{audio.isSubmittingRecordings
								? audio.submitRecordingsPendingLabel ?? "Wird verarbeitet..."
								: audio.submitRecordingsLabel ?? "Verarbeiten"}
						</Button>
					) : null}
				</div>
			) : null}

			<PromptInput onSubmit={handlePromptSubmit}>
				<PromptInputBody>
					<PromptInputTextarea
						className={cn(
							"min-h-[400px] resize-none rounded-t-lg border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20",
							mainTextareaClassName,
						)}
						disabled={isLoading}
						id={textareaId}
						onChange={(event) => {
							onInputValueChange(event.target.value);
						}}
						placeholder={inputPlaceholder}
						ref={textareaRef}
						value={inputValue}
						/>
					</PromptInputBody>
					<PromptInputToolbar>
						<PromptInputTools>
							<PromptInputActionMenu />
							{audio ? (
								<Button
									className={audio.isRecording ? "bg-solarized-red" : ""}
									disabled={isAudioToggleDisabled}
									onClick={handleToggleRecording}
									size="sm"
									title={audio.recordingButtonTitle}
									type="button"
									variant="ghost"
								>
									{audio.isRecording ? (
										<Square className="h-4 w-4" />
									) : (
										<Mic className="h-4 w-4" />
									)}
								</Button>
							) : null}
						</PromptInputTools>
						{showSubmit ? (
							<PromptInputSubmit disabled={isLoading || submitDisabled} />
						) : null}
					</PromptInputToolbar>
			</PromptInput>
		</div>
	);
};
