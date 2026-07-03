"use client";

import {
	PromptInput,
	PromptInputBody,
	PromptInputSubmit,
	PromptInputTextarea,
} from "@/app/_components/ai-elements/prompt-input";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { useCallback, useMemo } from "react";
import type { ChangeEvent, FormEvent, RefObject } from "react";
import {
	InputContextControls,
	useInputContextState,
} from "@/app/_components/input-context/input-context-controls";
import type { InputContextController } from "@/app/_components/input-context/types";
import { useInputContextClipboardPaste } from "@/app/_components/input-context/use-input-context-clipboard-paste";

interface AiscribeTemplateInputField {
	description?: string;
	label: string;
	name: string;
	placeholder: string;
	required?: boolean;
	type?: "text" | "textarea";
}

interface AiscribeTemplateInputSectionProps {
	additionalInputData: Record<string, string>;
	additionalInputs?: AiscribeTemplateInputField[];
	inputPlaceholder: string;
	inputContextController?: InputContextController;
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

export const AiscribeTemplateInputSection = ({
	additionalInputData,
	additionalInputs,
	inputPlaceholder,
	inputContextController,
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
	const fallbackInputContextController = useInputContextState();
	const resolvedInputContextController =
		inputContextController ?? fallbackInputContextController;
	const handleInputPaste = useInputContextClipboardPaste({
		controller: resolvedInputContextController,
		disabled: isLoading,
	});
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

	const handlePromptSubmit = useCallback(
		(_: unknown, event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!onSubmit) {
				return;
			}
			void onSubmit();
		},
		[onSubmit],
	);
	const hasAdditionalInputValue = useMemo(
		() =>
			(additionalInputs ?? []).some((field) =>
				Boolean(additionalInputData[field.name]?.trim()),
			),
		[additionalInputData, additionalInputs],
	);
	const additionalInputFields =
		additionalInputs && additionalInputs.length > 0 ? (
			<section className="space-y-4">
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
											"field-sizing-content min-h-[180px] resize-none overflow-hidden border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20",
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
			</section>
		) : null;

	return (
		<div className="space-y-4">
			<PromptInput
				className="[&>[data-slot=input-group]]:!ring-0 [&>[data-slot=input-group]]:rounded-none [&>[data-slot=input-group]]:border-0 [&>[data-slot=input-group]]:bg-transparent [&>[data-slot=input-group]]:shadow-none"
				onSubmit={handlePromptSubmit}
			>
				<InputContextControls
					controller={resolvedInputContextController}
					defaultPanel="text"
					disabled={isLoading}
					onFocusShortcut={
						textareaRef
							? () => {
									textareaRef.current?.focus();
								}
							: undefined
					}
					onSubmitShortcut={onSubmit}
					showSubmit={false}
					submitShortcutDisabled={isLoading || submitDisabled}
					textPanelContent={
						<div className="space-y-4">
							{additionalInputFields}
							<PromptInputBody>
								<PromptInputTextarea
									className={cn(
										"field-sizing-content !max-h-none min-h-[400px] resize-none overflow-hidden rounded-lg border border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus-visible:border-solarized-blue focus-visible:ring-[3px] focus-visible:ring-solarized-blue/20",
										mainTextareaClassName,
									)}
									disabled={isLoading}
									id={textareaId}
									onChange={(event) => {
										onInputValueChange(event.target.value);
									}}
									onPaste={handleInputPaste}
									placeholder={inputPlaceholder}
									ref={textareaRef}
									value={inputValue}
								/>
							</PromptInputBody>
						</div>
					}
					textPanelDescription="Gib Freitext ein oder wechsle zu Audio- oder Datei-Kontext."
					textPanelHasValue={
						inputValue.trim().length > 0 || hasAdditionalInputValue
					}
					textPanelTitle="Text"
					trailingAction={
						showSubmit ? (
							<PromptInputSubmit disabled={isLoading || submitDisabled} />
						) : null
					}
					variant="tabs"
				/>
			</PromptInput>
		</div>
	);
};
