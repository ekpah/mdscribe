"use client";

import Inputs from "@repo/design-system/components/inputs/inputs";
import type {
	FillInputsAudioFile,
	FillInputsContextFile,
	FillInputsInputField,
	FillInputsTextContext,
} from "@repo/design-system/components/inputs/inputs";
import { Card } from "@repo/design-system/components/ui/card";
import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

interface InputPreviewSectionProps {
	inputTags: InputTagType[];
	onValuesChange?: (values: Record<string, unknown>) => void;
	preview: (values: Record<string, unknown>) => ReactNode;
	previewToolbar?: ReactNode;
	resetKey?: string;
}

export const InputPreviewSection = ({
	inputTags,
	onValuesChange,
	preview,
	previewToolbar,
	resetKey,
}: InputPreviewSectionProps) => {
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [previewPanelElement, setPreviewPanelElement] = useState<HTMLDivElement | null>(null);
	const { data: session } = useSession();
	const isLoggedIn = Boolean(session?.user?.id);

	useEffect(() => {
		setValues({});
		onValuesChange?.({});
	}, [onValuesChange, resetKey]);

	const handleFormChange = useCallback(
		(data: Record<string, unknown>) => {
			setValues(data);
			onValuesChange?.(data);
		},
		[onValuesChange],
	);

	const handlePreviewPanelRef = useCallback((node: HTMLDivElement | null) => {
		setPreviewPanelElement(node);
	}, []);

	const handleFillInputs = useCallback(
		async (
			inputFields: FillInputsInputField[],
			audioFiles: FillInputsAudioFile[],
			textContext: FillInputsTextContext,
			contextFiles: FillInputsContextFile[],
		) => {
			const result = await orpc.scribe.fillInputs.call({
				audioFiles,
				contextFiles,
				inputFields,
				textContext,
			});
			return result.fieldValues;
		},
		[],
	);

	return (
		<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 overflow-hidden">
			<div className="hidden flex-col overflow-hidden md:flex" key="Inputs">
				<Inputs
					key={resetKey}
					inputTags={inputTags}
					onChange={handleFormChange}
					onFillInputs={isLoggedIn ? handleFillInputs : undefined}
					showFillInputs={isLoggedIn}
					textPanelPortalTarget={previewPanelElement}
				/>
			</div>
			<div
				className="relative col-span-3 flex min-h-0 flex-col overflow-hidden border-l p-4 md:col-span-2"
				key="Preview"
				ref={handlePreviewPanelRef}
			>
				{previewToolbar ? (
					<div className="mb-3 flex items-center gap-2">{previewToolbar}</div>
				) : null}
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
					{preview(values)}
				</div>
			</div>
		</Card>
	);
};
