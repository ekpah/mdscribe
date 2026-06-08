"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { ModelSelector } from "@repo/design-system/components/ui/model-selector";
import type { ModelSelectorOption } from "@repo/design-system/components/ui/model-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clipboard, FileCode2, FileText, Loader2, ScanText, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pdfjs } from "react-pdf";
import { toast } from "sonner";

import { DocumentInput } from "@/app/_components/input-context/inputs/document/document-input";
import type { UploadedContextFile } from "@/app/_components/input-context/types";
import {
	buildDefaultFieldDefinitionsFromPdfFields,
	buildParsedMarkdocFromFieldDefinitions,
	encodeUint8ArrayToBase64,
	MAX_PDF_UPLOAD_BYTES,
	parsePDFFormFields,
} from "@/app/documents/_lib";
import type { DocumentFieldDefinition } from "@/app/documents/_lib";
import { formatPayloadBytes } from "@/lib/input-fill-limits";
import { orpc } from "@/lib/orpc";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentModelOption extends ModelSelectorOption {
	modelId: string;
	providerId: string;
	providerName: string;
	providerProtocol: string;
}

interface AiFieldMapping {
	description: string;
	fieldName: string;
	label: string;
}

interface ParseFormResult {
	fieldMapping: AiFieldMapping[];
}

interface PdfPageRenderable {
	cleanup: () => void;
	getViewport: (params: { scale: number }) => { height: number; width: number };
	render: (params: {
		canvas: HTMLCanvasElement;
		canvasContext: CanvasRenderingContext2D;
		viewport: { height: number; width: number };
	}) => { promise: Promise<unknown> };
}

interface PdfDocumentRenderable {
	getPage: (pageNum: number) => Promise<PdfPageRenderable>;
	numPages: number;
}

type OutputTab = "markdoc" | "ocr";

const OCR_FILE_ACCEPT = [
	"application/pdf",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/webp",
].join(",");

const IMAGE_EXTENSION_MEDIA_TYPES = new Map([
	[".gif", "image/gif"],
	[".jpeg", "image/jpeg"],
	[".jpg", "image/jpeg"],
	[".png", "image/png"],
	[".webp", "image/webp"],
]);

const createModelOptions = (
	models: Awaited<ReturnType<typeof orpc.admin.models.list.call>> | undefined,
): DocumentModelOption[] =>
	(models ?? []).map((model) => ({
		group: model.providerName,
		keywords: [
			model.name,
			model.modelId,
			model.providerName,
			model.providerProtocol,
			"datei",
			"file",
			"image",
			"ocr",
			"pdf",
		],
		label: model.name,
		modelId: model.modelId,
		providerId: model.providerId,
		providerName: model.providerName,
		providerProtocol: model.providerProtocol,
		value: model.id,
	}));

const isPdfFile = (file: File): boolean => {
	const mimeType = file.type.split(";")[0]?.trim().toLowerCase();
	return mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
};

const getImageMediaType = (file: File): string | null => {
	const mimeType = file.type.split(";")[0]?.trim().toLowerCase();
	if (mimeType?.startsWith("image/")) {
		return mimeType;
	}

	const normalizedName = file.name.toLowerCase();
	for (const [extension, mediaType] of IMAGE_EXTENSION_MEDIA_TYPES) {
		if (normalizedName.endsWith(extension)) {
			return mediaType;
		}
	}

	return null;
};

const isSupportedOcrFile = (file: File): boolean => isPdfFile(file) || getImageMediaType(file) !== null;

const readFileBytes = async (file: File): Promise<Uint8Array> =>
	new Uint8Array(await file.arrayBuffer());

const renderPdfPageToBase64Jpeg = async (
	pdf: PdfDocumentRenderable,
	pageNum: number,
): Promise<string> => {
	const page = await pdf.getPage(pageNum);
	const viewport = page.getViewport({ scale: 1.5 });
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas-Kontext ist nicht verfügbar.");
	}

	canvas.height = viewport.height;
	canvas.width = viewport.width;
	await page.render({ canvas, canvasContext: ctx, viewport }).promise;
	page.cleanup();
	return canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
};

const convertPdfToImages = async (pdfBytes: Uint8Array, maxPages = 10): Promise<string[]> => {
	const pdf = (await pdfjs.getDocument({
		data: [...pdfBytes],
	}).promise) as unknown as PdfDocumentRenderable;
	const pageCount = Math.min(pdf.numPages, maxPages);
	const pageNumbers = Array.from({ length: pageCount }, (_value, index) => index + 1);
	return Promise.all(pageNumbers.map((pageNum) => renderPdfPageToBase64Jpeg(pdf, pageNum)));
};

const usesOpenAiCompatibleProtocol = (model: DocumentModelOption): boolean =>
	model.providerProtocol === "openai-compatible";

const toParseFormFieldMapping = (fieldDefinitions: DocumentFieldDefinition[]) =>
	fieldDefinitions.map((field) => ({
		description: field.description,
		fieldName: field.fieldName,
		inputKind: field.inputKind,
		label: field.label,
		options: field.options,
		pdfType: field.pdfType,
	}));

const toFallbackFieldDefinition = (fieldMapping: AiFieldMapping): DocumentFieldDefinition => ({
	description: fieldMapping.description,
	fieldName: fieldMapping.fieldName,
	inputKind: "text",
	isEnabled: true,
	label: fieldMapping.label,
	markdocType: "Info",
	options: [],
	pdfType: "text",
	valueType: "string",
});

const mergeAiFieldMappings = (
	baseFields: DocumentFieldDefinition[],
	aiMappings: AiFieldMapping[],
): DocumentFieldDefinition[] => {
	const aiByFieldName = new Map(aiMappings.map((mapping) => [mapping.fieldName, mapping]));
	const seenFieldNames = new Set<string>();
	const mergedFields = baseFields.map((field) => {
		seenFieldNames.add(field.fieldName);
		const aiMapping = aiByFieldName.get(field.fieldName);
		if (!aiMapping) {
			return field;
		}

		return {
			...field,
			description: aiMapping.description,
			label: aiMapping.label,
		};
	});

	for (const aiMapping of aiMappings) {
		if (!seenFieldNames.has(aiMapping.fieldName)) {
			mergedFields.push(toFallbackFieldDefinition(aiMapping));
		}
	}

	return mergedFields;
};

const quoteMarkdocValue = (value: string): string => JSON.stringify(value);

const renderStringAttribute = (name: string, value: string | undefined): string =>
	value ? ` ${name}=${quoteMarkdocValue(value)}` : "";

const renderBooleanAttribute = (name: string, value: boolean | undefined): string =>
	value ? ` ${name}=true` : "";

const fieldDefinitionsToMarkdoc = (fieldDefinitions: DocumentFieldDefinition[]): string => {
	const { inputTags } = buildParsedMarkdocFromFieldDefinitions(fieldDefinitions);

	return inputTags
		.map((inputTag) => {
			if (inputTag.name === "Info") {
				return `{% info ${quoteMarkdocValue(inputTag.attributes.primary)}${renderStringAttribute("description", inputTag.attributes.description)}${renderStringAttribute("type", inputTag.attributes.type)}${renderStringAttribute("unit", inputTag.attributes.unit)}${renderBooleanAttribute("renderUnit", inputTag.attributes.renderUnit)} /%}`;
			}

			if (inputTag.name === "Switch") {
				const cases = inputTag.children
					.map((child) => `{% case ${quoteMarkdocValue(child.attributes.primary)} %}${child.attributes.primary}{% /case %}`)
					.join("");
				return `{% switch ${quoteMarkdocValue(inputTag.attributes.primary)}${renderStringAttribute("type", inputTag.attributes.type)} %}${cases}{% /switch %}`;
			}

			return "";
		})
		.filter(Boolean)
		.join("\n");
};

const ModelSelectionCard = ({
	defaultFileImageModelId,
	isLoading,
	modelOptions,
	onModelChange,
	selectedModel,
	selectedModelId,
}: {
	defaultFileImageModelId: string | null | undefined;
	isLoading: boolean;
	modelOptions: DocumentModelOption[];
	onModelChange: (value: string) => void;
	selectedModel: DocumentModelOption | null;
	selectedModelId: string | null;
}) => (
	<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
		<CardHeader className="space-y-2 p-4 sm:p-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2 text-solarized-base00">
						<Sparkles className="h-4 w-4 text-solarized-magenta" />
						OCR/File/Image-Modell
					</CardTitle>
					<CardDescription className="text-solarized-base01">
						Wähle ein Modell für PDF-Parsing und OCR. MDScribe prüft die Modalität nicht
						automatisch.
					</CardDescription>
				</div>
				{defaultFileImageModelId && selectedModelId === defaultFileImageModelId ? (
					<Badge className="w-fit bg-solarized-magenta/10 text-solarized-magenta hover:bg-solarized-magenta/10">
						Standard-OCR-Modell
					</Badge>
				) : null}
			</div>
		</CardHeader>
		<CardContent className="grid gap-3 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.5fr)]">
			<div className="space-y-2">
				<Label htmlFor="document-playground-model">Modell</Label>
				<ModelSelector<DocumentModelOption>
					className="border-solarized-base2 bg-solarized-base3"
					emptyMessage="Keine Modelle synchronisiert."
					id="document-playground-model"
					isLoading={isLoading}
					onValueChange={onModelChange}
					options={modelOptions}
					placeholder="OCR/File/Image-Modell auswählen"
					renderOption={(option) => (
						<div className="min-w-0">
							<span className="block truncate">{option.label}</span>
							<span className="block truncate text-muted-foreground text-xs">
								{option.providerName} · {option.modelId}
							</span>
						</div>
					)}
					renderSelected={(option) =>
						option ? (
							<div className="min-w-0">
								<span className="block truncate">{option.label}</span>
								<span className="block truncate text-muted-foreground text-xs">
									{option.providerName} · {option.modelId}
								</span>
							</div>
						) : null
					}
					searchPlaceholder="Modell suchen..."
					value={selectedModelId}
				/>
			</div>
			<div className="rounded-md border border-solarized-base2/80 bg-solarized-base2/20 p-3 text-solarized-base01 text-xs">
				<div className="font-medium text-solarized-base00">Aktuelle Auswahl</div>
				<div className="mt-1">
					{selectedModel
						? `${selectedModel.providerName} · ${selectedModel.modelId}`
						: "Kein Modell ausgewählt"}
				</div>
			</div>
		</CardContent>
	</Card>
);

const DocumentFileCard = ({
	files,
	hasSelectedOcrFile,
	hasSelectedPdf,
	isBusy,
	isOcrPending,
	isParsePending,
	onFilesChange,
	onOcr,
	onParse,
	selectedFile,
	selectedModel,
}: {
	files: UploadedContextFile[];
	hasSelectedOcrFile: boolean;
	hasSelectedPdf: boolean;
	isBusy: boolean;
	isOcrPending: boolean;
	isParsePending: boolean;
	onFilesChange: (files: UploadedContextFile[]) => void;
	onOcr: () => void;
	onParse: () => void;
	selectedFile: File | null;
	selectedModel: DocumentModelOption | null;
}) => (
	<Card className="border-solarized-base2 bg-solarized-base3">
		<CardHeader className="p-4 sm:p-6">
			<CardTitle className="flex items-center gap-2 text-solarized-base00">
				<FileText className="h-4 w-4 text-solarized-magenta" />
				Datei
			</CardTitle>
			<CardDescription className="text-solarized-base01">
				Lade eine PDF- oder Bilddatei hoch. Maximal {formatPayloadBytes(MAX_PDF_UPLOAD_BYTES)}.
			</CardDescription>
		</CardHeader>
		<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
			<DocumentInput
				accept={OCR_FILE_ACCEPT}
				disabled={isBusy}
				emptyLabel="Noch keine PDF- oder Bilddatei hinzugefügt."
				maxFileBytes={MAX_PDF_UPLOAD_BYTES}
				maxFiles={1}
				maxTotalBytes={MAX_PDF_UPLOAD_BYTES}
				onValueChange={onFilesChange}
				value={files}
			/>
			{selectedFile && !hasSelectedOcrFile ? (
				<p className="text-solarized-red text-xs">
					Bitte eine PDF- oder Bilddatei auswählen. Andere Dateitypen werden hier nicht
					verarbeitet.
				</p>
			) : null}
			{selectedFile && hasSelectedOcrFile && !hasSelectedPdf ? (
				<p className="text-solarized-base01 text-xs">
					OCR funktioniert mit Bilddateien. Markdoc-Parsing ist nur für PDF-Formulare
					verfügbar.
				</p>
			) : null}
			<div className="grid gap-2 sm:grid-cols-2">
				<Button
					disabled={!hasSelectedPdf || !selectedModel || isBusy}
					onClick={onParse}
					type="button"
				>
					{isParsePending ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Wird geparst...
						</>
					) : (
						<>
							<FileCode2 className="mr-2 h-4 w-4" />
							Zu Markdoc parsen
						</>
					)}
				</Button>
				<Button
					disabled={!hasSelectedOcrFile || !selectedModel || isBusy}
					onClick={onOcr}
					type="button"
					variant="outline"
				>
					{isOcrPending ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							OCR läuft...
						</>
					) : (
						<>
							<ScanText className="mr-2 h-4 w-4" />
							OCR zu Text
						</>
					)}
				</Button>
			</div>
		</CardContent>
	</Card>
);

const OutputCard = ({
	activeOutput,
	activeOutputTab,
	lastModelName,
	markdocFieldCount,
	markdocOutput,
	ocrOutput,
	onCopy,
	onTabChange,
}: {
	activeOutput: string;
	activeOutputTab: OutputTab;
	lastModelName: string | null;
	markdocFieldCount: number;
	markdocOutput: string;
	ocrOutput: string;
	onCopy: () => void;
	onTabChange: (value: OutputTab) => void;
}) => (
	<Card className="min-h-[460px] border-solarized-base2 bg-solarized-base3">
		<CardHeader className="gap-3 p-4 sm:p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2 text-solarized-base00">
						<ScanText className="h-4 w-4 text-solarized-magenta" />
						Ausgabe
					</CardTitle>
					<CardDescription className="text-solarized-base01">
						{lastModelName
							? `Erzeugt mit ${lastModelName}`
							: "Markdoc oder OCR-Text erscheint nach der Verarbeitung hier."}
					</CardDescription>
				</div>
				<Button disabled={!activeOutput} onClick={onCopy} size="sm" type="button" variant="outline">
					<Clipboard className="mr-2 h-4 w-4" />
					Kopieren
				</Button>
			</div>
		</CardHeader>
		<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
			<Tabs
				onValueChange={(value) => {
					onTabChange(value as OutputTab);
				}}
				value={activeOutputTab}
			>
				<TabsList className="w-fit">
					<TabsTrigger value="markdoc">Markdoc</TabsTrigger>
					<TabsTrigger value="ocr">OCR-Text</TabsTrigger>
				</TabsList>
				<TabsContent value="markdoc" className="mt-3">
					<Textarea
						className="min-h-[340px] resize-y border-solarized-base2 bg-solarized-base2/20 font-mono text-solarized-base00 placeholder:text-solarized-base01 focus:border-solarized-magenta focus:ring-solarized-magenta/20"
						placeholder="Noch kein Markdoc vorhanden."
						readOnly
						value={markdocOutput}
					/>
					{markdocOutput ? (
						<p className="mt-2 text-solarized-base01 text-xs">
							{markdocFieldCount.toLocaleString("de-DE")} Felder in Markdoc-Tags
							umgewandelt.
						</p>
					) : null}
				</TabsContent>
				<TabsContent value="ocr" className="mt-3">
					<Textarea
						className="min-h-[340px] resize-y border-solarized-base2 bg-solarized-base2/20 font-mono text-solarized-base00 placeholder:text-solarized-base01 focus:border-solarized-magenta focus:ring-solarized-magenta/20"
						placeholder="Noch kein OCR-Text vorhanden."
						readOnly
						value={ocrOutput}
					/>
				</TabsContent>
			</Tabs>
		</CardContent>
	</Card>
);

export const DocumentPlaygroundClient = () => {
	const [files, setFiles] = useState<UploadedContextFile[]>([]);
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
	const [activeOutputTab, setActiveOutputTab] = useState<OutputTab>("markdoc");
	const [markdocOutput, setMarkdocOutput] = useState("");
	const [ocrOutput, setOcrOutput] = useState("");
	const [markdocFieldCount, setMarkdocFieldCount] = useState(0);
	const [lastModelName, setLastModelName] = useState<string | null>(null);

	const { data: models, isLoading: isLoadingModels } = useQuery(
		orpc.admin.models.list.queryOptions(),
	);
	const { data: defaults, isLoading: isLoadingDefaults } = useQuery(
		orpc.admin.providers.defaults.get.queryOptions(),
	);

	const modelOptions = useMemo(() => createModelOptions(models), [models]);
	const selectedModel = useMemo(
		() => modelOptions.find((option) => option.value === selectedModelId) ?? null,
		[modelOptions, selectedModelId],
	);
	const selectedFile = files[0]?.file ?? null;

	useEffect(() => {
		if (selectedModelId || !defaults?.defaultFileImageModelId) {
			return;
		}
		setSelectedModelId(defaults.defaultFileImageModelId);
	}, [defaults?.defaultFileImageModelId, selectedModelId]);

	useEffect(() => {
		if (!selectedModelId || modelOptions.length === 0) {
			return;
		}
		if (!modelOptions.some((option) => option.value === selectedModelId)) {
			setSelectedModelId(null);
		}
	}, [modelOptions, selectedModelId]);

	const handleFilesChange = useCallback((nextFiles: UploadedContextFile[]) => {
		setFiles(nextFiles);
		setMarkdocOutput("");
		setOcrOutput("");
		setMarkdocFieldCount(0);
		setLastModelName(null);
	}, []);

	const parseMutation = useMutation({
		mutationFn: async () => {
			if (!selectedModel) {
				throw new Error("Bitte zuerst ein OCR/File/Image-Modell auswählen.");
			}
			if (!selectedFile) {
				throw new Error("Bitte zuerst eine PDF-Datei hinzufügen.");
			}
			if (!isPdfFile(selectedFile)) {
				throw new Error("Markdoc-Parsing unterstützt aktuell nur PDF-Dateien.");
			}

			const pdfBytes = await readFileBytes(selectedFile);
			const pdfFields = await parsePDFFormFields(pdfBytes);
			const baseFieldDefinitions = buildDefaultFieldDefinitionsFromPdfFields(pdfFields.fields);
			const result = (await orpc.documents.parseForm.call({
				fieldMapping: toParseFormFieldMapping(baseFieldDefinitions),
				fileBase64: encodeUint8ArrayToBase64(pdfBytes),
				model: selectedModel.modelId,
				providerId: selectedModel.providerId,
			})) as ParseFormResult;
			const fieldDefinitions = mergeAiFieldMappings(
				baseFieldDefinitions,
				result.fieldMapping,
			);

			return {
				fieldCount: fieldDefinitions.length,
				markdoc: fieldDefinitionsToMarkdoc(fieldDefinitions),
				modelName: selectedModel.label,
			};
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Markdoc-Parsing fehlgeschlagen");
		},
		onSuccess: (result) => {
			setMarkdocOutput(result.markdoc);
			setMarkdocFieldCount(result.fieldCount);
			setLastModelName(result.modelName);
			setActiveOutputTab("markdoc");
			toast.success("Markdoc erzeugt");
		},
	});

	const ocrMutation = useMutation({
		mutationFn: async () => {
			if (!selectedModel) {
				throw new Error("Bitte zuerst ein OCR/File/Image-Modell auswählen.");
			}
			if (!selectedFile) {
				throw new Error("Bitte zuerst eine PDF- oder Bilddatei hinzufügen.");
			}
			if (!isSupportedOcrFile(selectedFile)) {
				throw new Error("OCR unterstützt PDF- und Bilddateien.");
			}

			const fileBytes = await readFileBytes(selectedFile);
			const fileBase64 = encodeUint8ArrayToBase64(fileBytes);
			const imageMediaType = getImageMediaType(selectedFile);
			if (imageMediaType) {
				const result = await orpc.scribe.ocrToMarkdown.call({
					images: [{ data: fileBase64, mediaType: imageMediaType }],
					model: selectedModel.modelId,
					providerId: selectedModel.providerId,
				});

				return {
					markdown: result.markdown,
					modelName: selectedModel.label,
				};
			}

			if (usesOpenAiCompatibleProtocol(selectedModel)) {
				const images = await convertPdfToImages(fileBytes);
				const result = await orpc.scribe.ocrToMarkdown.call({
					images: images.map((data) => ({
						data,
						mediaType: "image/jpeg",
					})),
					model: selectedModel.modelId,
					providerId: selectedModel.providerId,
				});

				return {
					markdown: result.markdown,
					modelName: selectedModel.label,
				};
			}

			const result = await orpc.scribe.ocrToMarkdown.call({
				fileBase64,
				model: selectedModel.modelId,
				providerId: selectedModel.providerId,
			});

			return {
				markdown: result.markdown,
				modelName: selectedModel.label,
			};
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "OCR fehlgeschlagen");
		},
		onSuccess: (result) => {
			setOcrOutput(result.markdown);
			setLastModelName(result.modelName);
			setActiveOutputTab("ocr");
			toast.success("Text extrahiert");
		},
	});

	const handleCopyActiveOutput = useCallback(async () => {
		const output = activeOutputTab === "markdoc" ? markdocOutput : ocrOutput;
		if (!output) {
			return;
		}
		await navigator.clipboard.writeText(output);
		toast.success(activeOutputTab === "markdoc" ? "Markdoc kopiert" : "Text kopiert");
	}, [activeOutputTab, markdocOutput, ocrOutput]);

	const isBusy = parseMutation.isPending || ocrMutation.isPending;
	const hasSelectedPdf = Boolean(selectedFile && isPdfFile(selectedFile));
	const hasSelectedOcrFile = Boolean(selectedFile && isSupportedOcrFile(selectedFile));
	const activeOutput = activeOutputTab === "markdoc" ? markdocOutput : ocrOutput;

	return (
		<div className="space-y-4">
			<ModelSelectionCard
				defaultFileImageModelId={defaults?.defaultFileImageModelId}
				isLoading={isLoadingModels || isLoadingDefaults}
				modelOptions={modelOptions}
				onModelChange={setSelectedModelId}
				selectedModel={selectedModel}
				selectedModelId={selectedModelId}
			/>

			<div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
				<DocumentFileCard
					files={files}
					hasSelectedOcrFile={hasSelectedOcrFile}
					hasSelectedPdf={hasSelectedPdf}
					isBusy={isBusy}
					isOcrPending={ocrMutation.isPending}
					isParsePending={parseMutation.isPending}
					onFilesChange={handleFilesChange}
					onOcr={() => {
						ocrMutation.mutate();
					}}
					onParse={() => {
						parseMutation.mutate();
					}}
					selectedFile={selectedFile}
					selectedModel={selectedModel}
				/>
				<OutputCard
					activeOutput={activeOutput}
					activeOutputTab={activeOutputTab}
					lastModelName={lastModelName}
					markdocFieldCount={markdocFieldCount}
					markdocOutput={markdocOutput}
					ocrOutput={ocrOutput}
					onCopy={handleCopyActiveOutput}
					onTabChange={setActiveOutputTab}
				/>
			</div>
		</div>
	);
};
