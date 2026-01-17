"use client";

import type { NewTemplate } from "@repo/database";
import Inputs, {
	type VoiceFillAudioFile,
} from "@repo/design-system/components/inputs/Inputs";
import { Card } from "@repo/design-system/components/ui/card";
import { DynamicMarkdocRenderer } from "@repo/markdoc-md";
import parseMarkdocToInputs, {
	type InputTagType,
} from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import { useCallback, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

export default function ContentSection({
	note,
}: {
	note: string;
	inputTags: string;
	template?: NewTemplate;
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
