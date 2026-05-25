"use client";

import { Card } from "@repo/design-system/components/ui/card";
import { DynamicMarkdocRenderer } from "@repo/markdoc-md";
import parseMarkdocToInputs from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { useMemo } from "react";

import { InputPreviewSection } from "@/app/_components/input-preview-section";

export default function ContentSection({
	note,
	examples,
	showExamples = false,
}: {
	note: string;
	examples: string[];
	showExamples?: boolean;
}) {
	const inputTags = useMemo(() => parseMarkdocToInputs(note), [note]);

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
							<div className="space-y-2" key={`template-example-preview-${example}`}>
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
		<InputPreviewSection
			inputTags={inputTags}
			preview={(values) => (
				<DynamicMarkdocRenderer
					className="prose prose-slate grow"
					markdocContent={note as string}
					variables={values}
				/>
			)}
			resetKey={note}
		/>
	);
}
