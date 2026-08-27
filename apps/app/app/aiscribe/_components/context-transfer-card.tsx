"use client";

import { blobToBase64 } from "@repo/design-system/components/inputs/audio-submission";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Switch } from "@repo/design-system/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@repo/design-system/components/ui/toggle-group";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, SendToBack } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createContextTransferLaunchUrl } from "@/app/_components/context-transfer/client";
import type {
	ContextTransferPayload,
	ContextTransferTargetType,
	TransferAudioFile,
} from "@/app/_components/context-transfer/types";
import type {
	InputContextController,
	InputContextFile,
	InputContextTextContext,
	InputContextTextContextKey,
} from "@/app/_components/input-context/types";
import {
	BUILT_IN_AISCRIBE_OVERRIDE_KEYS,
	getBuiltInAiscribeOverride,
} from "@/lib/aiscribe-built-ins";
import { buildCustomFormPath, buildWorkspacePath } from "@/lib/aiscribe-paths";
import {
	MAX_TRANSFER_PAYLOAD_BYTES,
	TransferPayloadTooLargeError,
} from "@/lib/context-transfer-crypto";
import { formatPayloadBytes } from "@/lib/input-fill-limits";
import { orpc } from "@/lib/orpc";
import {
	getPromptHarnessGender,
	getPromptHarnessLabel,
	getPromptHarnessTargetField,
} from "@/orpc/scribe/prompts";

import type { AdditionalInputField, AiscribeTemplateConfig } from "./aiscribe-template";

type TransferMode = "input" | "output";

interface TransferTargetOption {
	group: string;
	label: string;
	path: string;
	type: ContextTransferTargetType;
}

interface ContextTransferCardProps {
	activeTab: string;
	additionalInputData: Record<string, string>;
	additionalInputs?: AdditionalInputField[];
	completion: string;
	config: AiscribeTemplateConfig;
	inputContextController: InputContextController;
	inputValue: string;
	isAdmin: boolean;
}

const targetTypeLabels: Record<ContextTransferTargetType, string> = {
	"ai-form": "AI Vorlage",
	document: "Dokument",
	template: "Textbaustein",
	workspace: "Brief-Baukasten",
};

// Accusative declension of "verbessert" by the harness name's grammatical
// gender (object of "übernehmen") so the switch label reads e.g.
// "Verbesserte Anamnese" / "Verbesserten Entlassbrief".
const improvedAdjectiveEndings: Record<ReturnType<typeof getPromptHarnessGender>, string> = {
	feminine: "e",
	masculine: "en",
	neuter: "es",
	plural: "e",
};

const toContextFilePayload = async ({ file }: { file: File }): Promise<InputContextFile> => ({
	data: await blobToBase64(file),
	mimeType: file.type || "application/octet-stream",
	name: file.name,
	size: file.size,
});

const toAudioPayload = async (
	recording: InputContextController["audioRecordings"][number],
): Promise<TransferAudioFile> => ({
	data: await blobToBase64(recording.blob),
	duration: recording.duration,
	mimeType: recording.mimeType,
	sourceDeviceLabel: recording.sourceDeviceLabel,
});

const addFilledValue = (
	target: InputContextTextContext,
	key: string,
	value: string | undefined,
) => {
	const trimmed = value?.trim();
	if (!trimmed) {
		return;
	}
	if (["anamnese", "befunde", "diagnoseblock", "epikrise", "notes"].includes(key)) {
		target[key as InputContextTextContextKey] = trimmed;
	}
};

// Media is base64-encoded into the payload JSON (4/3 expansion); text sizes
// are approximated by character count. Slack covers JSON keys and escaping.
const toBase64Bytes = (rawBytes: number): number => Math.ceil(rawBytes / 3) * 4;

const estimateTransferPayloadBytes = ({
	controller,
	texts,
}: {
	controller: InputContextController;
	texts: (string | undefined)[];
}): number => {
	const mediaBytes =
		controller.audioRecordings.reduce(
			(sum, recording) => sum + toBase64Bytes(recording.blob.size),
			0,
		) + controller.contextFiles.reduce((sum, { file }) => sum + toBase64Bytes(file.size), 0);
	const textBytes = texts.reduce((sum, text) => sum + (text?.length ?? 0), 0);
	return mediaBytes + textBytes + 16 * 1024;
};

export const ContextTransferCard = ({
	activeTab,
	additionalInputData,
	additionalInputs,
	completion,
	config,
	inputContextController,
	inputValue,
	isAdmin,
}: ContextTransferCardProps) => {
	const [targetType, setTargetType] = useState<ContextTransferTargetType>("ai-form");
	const [targetPath, setTargetPath] = useState("");
	const [transferMode, setTransferMode] = useState<TransferMode>("input");
	const [hasUserSelectedMode, setHasUserSelectedMode] = useState(false);
	const [isCreatingTransfer, setIsCreatingTransfer] = useState(false);

	const templatesQuery = useQuery(orpc.templates.list.queryOptions());
	const formsQuery = useQuery(orpc.scribeForms.listAvailable.queryOptions());
	const workspacesQueryOptions = orpc.scribeWorkspaces.listAvailable.queryOptions();
	const workspacesQuery = useQuery({
		...workspacesQueryOptions,
		enabled: isAdmin,
	});
	const documentQueryOptions = orpc.documents.templates.list.queryOptions();
	const documentsQuery = useQuery({
		...documentQueryOptions,
		enabled: isAdmin,
	});

	const hasOutput = completion.trim().length > 0;

	useEffect(() => {
		if (hasUserSelectedMode) {
			return;
		}
		setTransferMode(activeTab === "output" && hasOutput ? "output" : "input");
	}, [activeTab, hasOutput, hasUserSelectedMode]);

	const aiTargets = useMemo<TransferTargetOption[]>(() => {
		const builtIns = BUILT_IN_AISCRIBE_OVERRIDE_KEYS.map((key) => {
			const builtIn = getBuiltInAiscribeOverride(key);
			return {
				group: getPromptHarnessLabel(builtIn.defaultPromptHarness),
				label: builtIn.title,
				path: builtIn.path,
				type: "ai-form" as const,
			};
		});
		const configuredForms =
			formsQuery.data?.map((form) => ({
				group: getPromptHarnessLabel(form.promptHarness),
				label: form.name,
				path: buildCustomFormPath(form.slug, form.author?.username ?? null),
				type: "ai-form" as const,
			})) ?? [];
		return [...builtIns, ...configuredForms];
	}, [formsQuery.data]);

	const targetOptionsByType = useMemo<Record<ContextTransferTargetType, TransferTargetOption[]>>(
		() => ({
			"ai-form": aiTargets,
			document:
				documentsQuery.data?.map((document) => ({
					group: targetTypeLabels.document,
					label: document.title,
					path: `/documents/${document.id}`,
					type: "document" as const,
				})) ?? [],
			template:
				templatesQuery.data?.map((template) => ({
					group: targetTypeLabels.template,
					label: template.title,
					path: `/templates/${template.id}`,
					type: "template" as const,
				})) ?? [],
			workspace:
				workspacesQuery.data?.map((workspace) => ({
					group: targetTypeLabels.workspace,
					label: workspace.name,
					path: buildWorkspacePath(workspace.slug, workspace.authorUsername),
					type: "workspace" as const,
				})) ?? [],
		}),
		[aiTargets, documentsQuery.data, templatesQuery.data, workspacesQuery.data],
	);

	const targetOptions = targetOptionsByType[targetType];
	const selectedTarget = targetOptions.find((target) => target.path === targetPath);

	const groupedTargetOptions = useMemo(() => {
		const groups = new Map<string, TransferTargetOption[]>();
		for (const option of targetOptions) {
			const existing = groups.get(option.group);
			if (existing) {
				existing.push(option);
			} else {
				groups.set(option.group, [option]);
			}
		}
		return [...groups.entries()];
	}, [targetOptions]);

	const estimatedPayloadBytes = useMemo(
		() =>
			estimateTransferPayloadBytes({
				controller: inputContextController,
				texts: [
					inputValue,
					transferMode === "output" ? completion : undefined,
					...Object.values(additionalInputData),
					...Object.values(inputContextController.textContext),
				],
			}),
		[additionalInputData, completion, inputContextController, inputValue, transferMode],
	);
	const isPayloadTooLarge = estimatedPayloadBytes > MAX_TRANSFER_PAYLOAD_BYTES;

	useEffect(() => {
		const options = targetOptionsByType[targetType];
		if (options.some((target) => target.path === targetPath)) {
			return;
		}
		setTargetPath(options[0]?.path ?? "");
	}, [targetOptionsByType, targetPath, targetType]);

	const buildTransferPayload = useCallback(async (): Promise<ContextTransferPayload> => {
		const textContext: InputContextTextContext = {
			...inputContextController.textContext,
		};

		for (const field of additionalInputs ?? []) {
			addFilledValue(textContext, field.name, additionalInputData[field.name]);
		}

		// The main input is the harness target field behind the scenes; with
		// "Ausgabe übernehmen" the generated output replaces it.
		const targetField = getPromptHarnessTargetField(
			config.promptHarness ?? ("documentType" in config ? config.documentType : undefined),
		);
		if (transferMode === "output" && completion.trim()) {
			textContext[targetField] = completion.trim();
		} else {
			addFilledValue(textContext, targetField, inputValue);
		}

		const [audioFiles, contextFiles] = await Promise.all([
			Promise.all(inputContextController.audioRecordings.map(toAudioPayload)),
			Promise.all(inputContextController.contextFiles.map(toContextFilePayload)),
		]);

		return {
			audioFiles,
			contextFiles,
			source: {
				promptHarness: config.promptHarness,
				title: config.title,
			},
			textContext,
			version: 1,
		};
	}, [
		additionalInputData,
		additionalInputs,
		completion,
		config,
		inputContextController.audioRecordings,
		inputContextController.contextFiles,
		inputContextController.textContext,
		inputValue,
		transferMode,
	]);

	const handleOpenTarget = useCallback(async () => {
		if (!selectedTarget) {
			toast.error("Bitte ein Ziel auswählen.");
			return;
		}

		setIsCreatingTransfer(true);
		try {
			const payload = await buildTransferPayload();
			const launchUrl = await createContextTransferLaunchUrl({
				payload,
				targetPath: selectedTarget.path,
			});
			window.open(launchUrl, "_blank", "noopener,noreferrer");
		} catch (error) {
			console.error("Failed to create context transfer:", error);
			if (error instanceof TransferPayloadTooLargeError) {
				toast.error(
					`Eingaben zu groß für die Übergabe. Maximal ${formatPayloadBytes(MAX_TRANSFER_PAYLOAD_BYTES)} möglich.`,
				);
			} else {
				toast.error("Kontext konnte nicht weitergegeben werden.");
			}
		} finally {
			setIsCreatingTransfer(false);
		}
	}, [buildTransferPayload, selectedTarget]);

	const availableTargetTypes: ContextTransferTargetType[] = isAdmin
		? ["template", "ai-form", "workspace", "document"]
		: ["template", "ai-form"];

	const harnessReference =
		config.promptHarness ?? ("documentType" in config ? config.documentType : undefined);
	// "Ausgabe" is feminine; an undeclared fallback keeps the default ending.
	const harnessLabel = harnessReference ? getPromptHarnessLabel(harnessReference) : "Ausgabe";
	const harnessGender = harnessReference ? getPromptHarnessGender(harnessReference) : "feminine";
	const improvedAdjective = `Verbessert${improvedAdjectiveEndings[harnessGender]}`;

	return (
		<Card className="h-fit border-solarized-cyan/20 shadow-lg">
			<CardHeader className="bg-solarized-cyan/5">
				<div className="flex items-center gap-2">
					<SendToBack className="h-4 w-4 text-solarized-cyan" />
					<CardTitle className="text-base text-foreground">Weiterverwenden</CardTitle>
				</div>
				<CardDescription>
					Die aktuellen Informationen übertragen und in einem anderen Formular weiterverwenden
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4 p-6">
				<div className="space-y-2">
					<Label className="text-xs">Typ</Label>
					<ToggleGroup
						className="w-full"
						onValueChange={(values) => {
							const [value] = values;
							if (value) {
								setTargetType(value as ContextTransferTargetType);
							}
						}}
						value={[targetType]}
						variant="outline"
					>
						{availableTargetTypes.map((type) => (
							<ToggleGroupItem className="flex-1 text-xs" key={type} value={type}>
								{targetTypeLabels[type]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>

				<div className="space-y-2">
					<Label className="text-xs">Ziel</Label>
					<Select
						disabled={targetOptions.length === 0}
						onValueChange={setTargetPath}
						value={targetPath}
					>
						<SelectTrigger>
							<SelectValue placeholder="Ziel auswählen" />
						</SelectTrigger>
						<SelectContent>
							{groupedTargetOptions.map(([group, options]) => (
								<SelectGroup key={group}>
									<SelectLabel>{group}</SelectLabel>
									{options.map((target) => (
										<SelectItem key={target.path} value={target.path}>
											{target.label}
										</SelectItem>
									))}
								</SelectGroup>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
					<div className="min-w-0">
						<div className="font-medium text-sm">
							{improvedAdjective} {harnessLabel} übernehmen
						</div>
						<div className="text-muted-foreground text-xs">
							{transferMode === "output"
								? "Die verbesserte Version wird statt der Eingabe übergeben"
								: "Die aktuelle Eingabe wird übergeben"}
						</div>
					</div>
					<Switch
						checked={transferMode === "output"}
						disabled={!hasOutput}
						onCheckedChange={(checked) => {
							setHasUserSelectedMode(true);
							setTransferMode(checked ? "output" : "input");
						}}
					/>
				</div>

				<Button
					className="w-full"
					disabled={!selectedTarget || isCreatingTransfer || isPayloadTooLarge}
					onClick={handleOpenTarget}
					type="button"
				>
					{isCreatingTransfer ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<ExternalLink className="h-4 w-4" />
					)}
					In neuem Tab öffnen
				</Button>
				{isPayloadTooLarge ? (
					<p className="text-destructive text-xs">
						Eingaben zu groß für die Übergabe (ca. {formatPayloadBytes(estimatedPayloadBytes)},
						maximal {formatPayloadBytes(MAX_TRANSFER_PAYLOAD_BYTES)}). Entfernen Sie Audio- oder
						Dateianhänge, um den Kontext weiterzugeben.
					</p>
				) : null}
			</CardContent>
		</Card>
	);
};
