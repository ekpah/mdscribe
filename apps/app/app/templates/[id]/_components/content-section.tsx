"use client";

import Inputs, {
	type VoiceFillAudioFile,
} from "@repo/design-system/components/inputs/inputs";
import { Card } from "@repo/design-system/components/ui/card";
import { DynamicMarkdocRenderer } from "@repo/markdoc-md";
import parseMarkdocToInputs, {
	type InputTagType,
} from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { useCallback, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

export default function ContentSection({
	note,
	examples,
	showExamples = false,
}: {
	note: string;
	examples: string[];
	showExamples?: boolean;
}) {
	const [values, setValues] = useState<Record<string, unknown>>({});
	const { data: session } = useSession();
	const isLoggedIn = Boolean(session?.user?.id);

	const handleFormChange = (data: Record<string, unknown>) => {
		setValues(data);
	};

	const handleVoiceFill = useCallback(
		async (inputTags: InputTagType[], audioFiles: VoiceFillAudioFile[]) => {
			const result = await orpc.scribe.voiceFill.call({
				inputTags,
				audioFiles,
			});
			return result.fieldValues;
		},
		[],
	);

	if (showExamples) {
		return (
			<Card className="h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] overflow-y-auto p-4">
				{examples.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						Keine Beispiel-Ausgaben vorhanden.
					</p>
				) : (
					<div className="space-y-4">
						{examples.map((example, index) => (
							<div className="space-y-2" key={`template-example-preview-${index}`}>
								<p className="font-medium text-sm">Beispiel {index + 1}</p>
								<pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
									{example}
								</pre>
							</div>
						))}
					</div>
				)}
			</Card>
		);
	}

	return (
		<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 overflow-hidden">
			<div className="hidden md:flex flex-col overflow-hidden" key="Inputs">
				<Inputs
					inputTags={parseMarkdocToInputs(note)}
					onChange={handleFormChange}
					onVoiceFill={isLoggedIn ? handleVoiceFill : undefined}
					showVoiceInput={isLoggedIn}
				/>
			</div>
			<div
				className="col-span-3 overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
				key="Note"
			>
				<DynamicMarkdocRenderer
					className="prose prose-slate grow"
					markdocContent={note as string}
					variables={values}
				/>
			</div>
		</Card>
	);
}
