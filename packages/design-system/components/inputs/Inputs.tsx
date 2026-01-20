"use client";

import type {
	InfoInputTagType,
	InputTagType,
} from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import Formula from "fparser";
import { Mic, Sigma, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../ui/tooltip";
import { InfoInput } from "./ui/InfoInput";
import { SwitchInput } from "./ui/SwitchInput";

interface InputsProps {
	inputTags: InputTagType[];
	onChange: (data: Record<string, unknown>) => void;
	showVoiceInput?: boolean;
	onVoiceFill?: (
		inputTags: InputTagType[],
		audioFiles: VoiceFillAudioFile[],
	) => Promise<VoiceFillResult>;
}

type VoiceFillInputField = {
	label: string;
	description?: string;
};

export type VoiceFillAudioFile = {
	data: string;
	mimeType: string;
};

export type VoiceFillResult = Record<string, string>;

interface AudioRecording {
	blob: Blob;
	duration: number;
	id: string;
}

type InputMeta = {
	type: "string" | "number" | "date" | "switch";
};

const collectVoiceInputFields = (inputTags: InputTagType[]) => {
	const fields: VoiceFillInputField[] = [];
	const meta = new Map<string, InputMeta>();
	const seen = new Set<string>();

	const pushField = (
		label: string | undefined,
		description: string | undefined,
		type: InputMeta["type"],
	) => {
		if (!label || seen.has(label)) return;
		fields.push({ label, description });
		meta.set(label, { type });
		seen.add(label);
	};

	const visit = (input: InputTagType) => {
		if (input.name === "Info") {
			pushField(
				input.attributes.primary,
				input.attributes.description,
				input.attributes.type ?? "string",
			);
			input.children?.forEach(visit);
			return;
		}

		if (input.name === "Switch") {
			pushField(input.attributes.primary, undefined, "switch");
			input.children?.forEach(visit);
			return;
		}

		if (input.name === "Case") {
			input.children?.forEach(visit);
			return;
		}

		if (input.name === "Score") {
			input.children?.forEach(visit);
		}
	};

	inputTags.forEach(visit);

	return { fields, meta };
};

const normalizeVoiceValue = (value: string, meta?: InputMeta) => {
	if (!meta) return value;
	if (meta.type === "number") {
		const normalized = Number(value.replace(",", "."));
		return Number.isNaN(normalized) ? undefined : normalized;
	}
	return value;
};

function renderInputTag(
	input: InputTagType,
	values: Record<string, unknown>,
	handleInputChange: (name: string, value: unknown) => void,
): React.ReactNode | null {
	if (!input.attributes.primary) {
		return null;
	}

	if (input.name === "Info") {
		return (
			<InfoInput
				input={input}
				key={`info-${input.attributes.primary}`}
				onChange={(value) => handleInputChange(input.attributes.primary, value)}
				value={values[input.attributes.primary] as string | number | undefined}
			/>
		);
	}

	if (input.name === "Switch") {
		const currentValue = values[input.attributes.primary] as string | undefined;

		return (
			<div key={`switch-${input.attributes.primary}`}>
				<SwitchInput
					input={input}
					onChange={(value) =>
						handleInputChange(input.attributes.primary, value)
					}
					value={currentValue}
				/>
				{/* Render children of selected case */}
				{currentValue && input.children && (
					<div className="mt-4 ml-4 space-y-4">
						{input.children
							.filter(
								(child) =>
									child.name === "Case" &&
									child.attributes.primary === currentValue,
							)
							.flatMap((caseChild) =>
								caseChild.children.map((grandChild) =>
									renderInputTag(grandChild, values, handleInputChange),
								),
							)}
					</div>
				)}
			</div>
		);
	}

	if (input.name === "Score") {
		const score = () => {
			try {
				const f = new Formula(input.attributes.formula ?? "");
				const result = f.evaluate(values as Record<string, number>);

				const roundedResult =
					typeof result === "number" ? Number(result.toFixed(2)) : result;

				return roundedResult;
			} catch (error) {
				return 0;
			}
		};

		return (
			<div
				className="justify-center-center w-full max-w-full space-y-3"
				key={`score-${input.attributes.primary}`}
			>
				<Label
					className="font-medium text-foreground"
					htmlFor={`score-${input.attributes.primary}`}
				>
					{input.attributes.primary}
				</Label>
				<TooltipProvider delayDuration={0}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge className="ml-2 bg-muted-foreground">
								<Sigma aria-hidden="true" className="opacity-60" size={12} />
							</Badge>
						</TooltipTrigger>
						<TooltipContent className="overflow-hidden px-2 py-1 text-sm">
							<div className="space-y-1">
								<p className="font-medium text-[13px]">Formel</p>
								<p className="text-wrap font-mono text-muted-foreground text-xs">
									{input.attributes.formula ? (
										<span className=" text-muted-foreground">
											{input.attributes.formula
												?.replace(
													/(\[[\w_]+\])|([^a-zA-Z[\]])/g,
													(_match, p1, p2) => (p1 ? p1 : ` ${p2} `),
												)
												.replace(/\s+/g, " ")
												.trim()}
										</span>
									) : (
										<span className="text-muted-foreground">Keine Formel</span>
									)}
								</p>
							</div>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Read-only calculated score display */}
				<div className="w-full max-w-full space-y-1">
					<Input
						className="h-9 w-full max-w-full cursor-default border-input bg-muted font-medium text-foreground focus:border-solarized-orange focus:ring-solarized-orange/20"
						id={`score-${input.attributes.primary}`}
						readOnly
						value={`${score()}${input.attributes.unit ? ` ${input.attributes.unit}` : ""}`}
					/>
				</div>
				{/* Variable inputs (indented) */}
				{input.children.length > 0 && (
					<div className="ml-4 w-full max-w-full space-y-3 border-muted border-l-2 pr-4 pl-4">
						{input.children.map((child) => (
							<div
								className="w-full max-w-full space-y-1"
								key={child.attributes.primary}
							>
								<InfoInput
									input={
										{
											attributes: {
												primary: child.attributes.primary,
												type: "number",
											},
										} as InfoInputTagType
									}
									onChange={(value) =>
										handleInputChange(child.attributes.primary, value)
									}
									value={values[child.attributes.primary] as number | undefined}
								/>
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	return null;
}

export default function Inputs({
	inputTags = [],
	onChange,
	showVoiceInput = false,
	onVoiceFill,
}: InputsProps) {
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [isRecording, setIsRecording] = useState(false);
	const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
	const [isVoiceFillPending, setIsVoiceFillPending] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingStartTimeRef = useRef<number>(0);
	const maxRecordings = 3;

	useEffect(() => {
		onChange(values);
	}, [values, onChange]);

	const handleInputChange = (key: string, value: unknown) => {
		setValues((prevValues) => ({
			...prevValues,
			[key]: value,
		}));
	};

	const { fields: voiceInputFields, meta: voiceInputMeta } = useMemo(
		() => collectVoiceInputFields(inputTags),
		[inputTags],
	);

	const canRecord = audioRecordings.length < maxRecordings;

	const handleStartRecording = async () => {
		if (!canRecord) {
			toast.error(`Maximal ${maxRecordings} Aufnahmen möglich`);
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			recordingStartTimeRef.current = Date.now();

			mediaRecorder.addEventListener("dataavailable", (event) => {
				audioChunksRef.current.push(event.data);
			});

			mediaRecorder.addEventListener("stop", () => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: "audio/wav",
				});
				const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
				const newRecording: AudioRecording = {
					blob: audioBlob,
					duration,
					id: `audio-${Date.now()}`,
				};
				setAudioRecordings((prev) => [...prev, newRecording]);
				for (const track of stream.getTracks()) {
					track.stop();
				}
			});

			mediaRecorder.start();
			setIsRecording(true);
			toast.success("Aufnahme gestartet");
		} catch (error) {
			console.error("Error starting recording:", error);
			toast.error("Fehler beim Starten der Aufnahme");
		}
	};

	const handleStopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
			toast.success("Aufnahme beendet");
		}
	};

	const handleToggleRecording = () => {
		if (isRecording) {
			handleStopRecording();
		} else {
			handleStartRecording();
		}
	};

	const handleRemoveRecording = (id: string) => {
		setAudioRecordings((prev) =>
			prev.filter((recording) => recording.id !== id),
		);
	};

	const formatDuration = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const handleVoiceFill = async () => {
		if (!onVoiceFill) {
			return;
		}

		if (audioRecordings.length === 0) {
			toast.error("Bitte zuerst Audio aufnehmen");
			return;
		}

		if (voiceInputFields.length === 0) {
			toast.error("Keine Eingabefelder verfügbar");
			return;
		}

		setIsVoiceFillPending(true);
		toast.loading("Felder werden mit Spracheingabe ausgefüllt...", {
			id: "voice-fill",
		});

		try {
			const audioFiles: VoiceFillAudioFile[] = await Promise.all(
				audioRecordings.map(async (rec) => {
					const reader = new FileReader();
					const base64 = await new Promise<string>((resolve) => {
						reader.onloadend = () => {
							const result = reader.result as string;
							resolve(result.split(",")[1]);
						};
						reader.readAsDataURL(rec.blob);
					});
					return { data: base64, mimeType: rec.blob.type };
				}),
			);

			const fieldValues = await onVoiceFill(inputTags, audioFiles);

			for (const [field, value] of Object.entries(fieldValues)) {
				const normalizedValue = normalizeVoiceValue(
					value,
					voiceInputMeta.get(field),
				);
				if (typeof normalizedValue !== "undefined") {
					handleInputChange(field, normalizedValue);
				}
			}

			setAudioRecordings([]);
			toast.success("Felder mit Spracheingabe ausgefüllt", {
				id: "voice-fill",
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unbekannter Fehler";
			toast.error(`Sprachausfüllung fehlgeschlagen: ${errorMessage}`, {
				id: "voice-fill",
			});
		} finally {
			setIsVoiceFillPending(false);
		}
	};

	if (inputTags.length === 0 || !inputTags) {
		return null;
	}

	const shouldShowVoiceInput = Boolean(showVoiceInput && onVoiceFill);

	return (
		<form className="flex h-full w-full flex-col overflow-hidden">
			{/* Scrollable inputs area */}
			<div
				className="flex-1 space-y-6 overflow-y-auto overscroll-none p-4 pr-4"
				key="inputs-list"
			>
				{inputTags.map((inputTag) =>
					renderInputTag(inputTag, values, handleInputChange),
				)}
			</div>
			{/* Fixed voice input footer */}
			{shouldShowVoiceInput && (
				<div className="shrink-0 border-t border-t-solarized-blue/30 bg-solarized-blue/5 px-4 py-3">
					<div className="mb-2 flex items-center justify-between">
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<Mic className="h-3.5 w-3.5" />
							<span>Sprache</span>
						</div>
						<Button
							aria-label={
								isRecording ? "Aufnahme stoppen" : "Audioaufnahme starten"
							}
							className={isRecording ? "bg-solarized-red text-white" : ""}
							disabled={!(canRecord || isRecording)}
							onClick={handleToggleRecording}
							size="icon"
							title={
								canRecord || isRecording
									? isRecording
										? "Aufnahme stoppen"
										: "Audioaufnahme starten"
									: `Maximal ${maxRecordings} Aufnahmen möglich`
							}
							type="button"
							variant={isRecording ? "default" : "outline"}
						>
							{isRecording ? (
								<Square className="h-4 w-4" />
							) : (
								<Mic className="h-4 w-4" />
							)}
						</Button>
					</div>

					{audioRecordings.length > 0 && (
						<div className="mb-2 space-y-1">
							{audioRecordings.map((recording, index) => (
								<div
									className="flex items-center justify-between rounded-md border border-solarized-green/30 bg-solarized-green/10 px-2 py-1"
									key={recording.id}
								>
									<div className="flex items-center gap-2 text-solarized-green text-xs">
										<Mic className="h-3.5 w-3.5" />
										<span>
											#{index + 1} · {formatDuration(recording.duration)}
										</span>
									</div>
									<Button
										aria-label="Aufnahme entfernen"
										onClick={() => handleRemoveRecording(recording.id)}
										size="icon"
										type="button"
										variant="ghost"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					)}

					<Button
						className="w-full"
						disabled={audioRecordings.length === 0 || isVoiceFillPending}
						onClick={handleVoiceFill}
						type="button"
						variant="default"
					>
						{isVoiceFillPending ? (
							"..."
						) : (
							<>
								<Mic className="mr-2 h-4 w-4" />
								Füllen
							</>
						)}
					</Button>
				</div>
			)}
		</form>
	);
}
