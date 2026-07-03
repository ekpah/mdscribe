"use client";

import type { RenderableTreeNode } from "@markdoc/markdoc";
import * as Markdoc from "@markdoc/markdoc";
import Inputs from "@repo/design-system/components/inputs/inputs";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import config from "@repo/markdoc-md/markdoc-config";
import parseMarkdocToInputs from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import {
	ChevronDown,
	ChevronRight,
	Code,
	Eye,
	FileText,
	Layers,
	Settings,
	TreePine,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { MemoizedCopySection } from "@/app/aiscribe/_components/memoized-copy-section";

import TipTap from "./tip-tap-dynamic";

const DEFAULT_TEMPLATE = `# Patient Score

Patient: {% info "patient_name" /%}
Alter: {% info "age" /%}

## Score Berechnung
{% score formula="[age]*2+[gender_score]*3+[diabetes]*2+[hypertension]*2+[heart_failure]*2+[vascular_disease]*2+[stroke]*2+[smoking]*1" unit="Punkte" /%}

{% info "age" label="Alter" type="number" /%}
{% info "gender" label="Geschlecht" type="select" options="male,female" /%}
{% switch "diabetes" type="boolean" %}{% case "true" %}Diabetes mellitus{% /case %}{% case "false" %}Kein Diabetes mellitus{% /case %}{% /switch %}
{% switch "hypertension" type="boolean" %}{% case "true" %}Arterielle Hypertonie{% /case %}{% case "false" %}Keine arterielle Hypertonie{% /case %}{% /switch %}
{% switch "heart_failure" type="boolean" %}{% case "true" %}Herzinsuffizienz{% /case %}{% case "false" %}Keine Herzinsuffizienz{% /case %}{% /switch %}
{% switch "vascular_disease" type="boolean" %}{% case "true" %}Gefäßerkrankung{% /case %}{% case "false" %}Keine Gefäßerkrankung{% /case %}{% /switch %}
{% switch "stroke" type="boolean" %}{% case "true" %}Schlaganfall/TIA{% /case %}{% case "false" %}Kein Schlaganfall/TIA{% /case %}{% /switch %}
{% switch "smoking" type="boolean" %}{% case "true" %}Raucher{% /case %}{% case "false" %}Nichtraucher{% /case %}{% /switch %}

## Geschlecht
{% switch "gender" %}
  {% case "male" %}Männlich{% /case %}
  {% case "female" %}Weiblich{% /case %}
  {% case "other" %}Divers{% /case %}
{% /switch %}`;

const RESET_TEMPLATE = `# Beispiel Arztbericht

Patient: {% info "patient_name" /%}
Alter: {% info "age" /%}
Datum: {% info "date" /%}

## Hauptbeschwerde
{% info "chief_complaint" /%}

## Bewertung
{% info "assessment" /%}

## Behandlungsplan
{% info "plan" /%}

## Geschlecht
# Beispiel Arztbericht

## Geschlecht
{% switch "gender" %}
  {% case "male" %}Männlich{% /case %}
  {% case "female" %}Weiblich{% /case %}
  {% case "other" %}Divers{% /case %}
{% /switch %}`;

const getArrayItemKey = (item: unknown): string => {
	if (typeof item === "object" && item !== null) {
		if ("id" in item && typeof item.id === "string") {
			return `id:${item.id}`;
		}
		if ("key" in item && typeof item.key === "string") {
			return `key:${item.key}`;
		}
		return `json:${JSON.stringify(item)}`;
	}

	return `${typeof item}:${String(item)}`;
};

const ObjectNodeName = ({ name, className = "" }: { className?: string; name: string }) =>
	name ? <span className={className || "text-solarized-blue"}>{name}: </span> : null;

const PrimitiveObjectNode = ({
	className,
	indent,
	name,
	value,
}: {
	className: string;
	indent: number;
	name: string;
	value: string;
}) => (
	<div style={{ marginLeft: indent }} className={className}>
		<ObjectNodeName name={name} />
		<span>{value}</span>
	</div>
);

const EmptyObjectNode = ({
	indent,
	name,
	value,
}: {
	indent: number;
	name: string;
	value: string;
}) => (
	<div style={{ marginLeft: indent }}>
		<ObjectNodeName name={name} />
		<span className="text-muted-foreground">{value}</span>
	</div>
);

const ObjectNodeToggle = ({
	children,
	indent,
	isExpanded,
	name,
	onToggle,
}: {
	children: ReactNode;
	indent: number;
	isExpanded: boolean;
	name: string;
	onToggle: () => void;
}) => (
	<button
		style={{ marginLeft: indent }}
		className="-mx-1 cursor-pointer select-none rounded px-1 text-left hover:bg-muted/50"
		onClick={onToggle}
		type="button"
	>
		{isExpanded ? (
			<ChevronDown className="inline h-3 w-3 text-muted-foreground" />
		) : (
			<ChevronRight className="inline h-3 w-3 text-muted-foreground" />
		)}
		<ObjectNodeName className="ml-1 text-solarized-blue" name={name} />
		<span className="text-muted-foreground">{children}</span>
	</button>
);

const getKeyedArrayItems = (items: unknown[]) => {
	const keyedItems: { item: unknown; key: string }[] = [];
	const keyCounts = new Map<string, number>();
	for (const item of items) {
		const baseKey = getArrayItemKey(item);
		const count = keyCounts.get(baseKey) ?? 0;
		keyCounts.set(baseKey, count + 1);
		keyedItems.push({
			item,
			key: `${baseKey}:${count}`,
		});
	}
	return keyedItems;
};

const ArrayObjectNode = ({
	data,
	indent,
	isExpanded,
	level,
	name,
	onToggle,
	renderChildNode,
}: {
	data: unknown[];
	indent: number;
	isExpanded: boolean;
	level: number;
	name: string;
	onToggle: () => void;
	renderChildNode: (data: unknown, name: string, level: number) => ReactNode;
}) => {
	if (data.length === 0) {
		return <EmptyObjectNode indent={indent} name={name} value="[]" />;
	}

	const keyedItems = getKeyedArrayItems(data);
	return (
		<div>
			<ObjectNodeToggle indent={indent} isExpanded={isExpanded} name={name} onToggle={onToggle}>
				[{data.length} {data.length === 1 ? "item" : "items"}]
			</ObjectNodeToggle>
			{isExpanded && (
				<div>
					{keyedItems.map(({ item, key }, index) => (
						<div key={key}>{renderChildNode(item, `[${index}]`, level + 1)}</div>
					))}
				</div>
			)}
		</div>
	);
};

const RecordObjectNode = ({
	data,
	indent,
	isExpanded,
	level,
	name,
	onToggle,
	renderChildNode,
}: {
	data: Record<string, unknown>;
	indent: number;
	isExpanded: boolean;
	level: number;
	name: string;
	onToggle: () => void;
	renderChildNode: (data: unknown, name: string, level: number) => ReactNode;
}) => {
	const entries = Object.entries(data);
	if (entries.length === 0) {
		return <EmptyObjectNode indent={indent} name={name} value="{}" />;
	}

	return (
		<div>
			<ObjectNodeToggle indent={indent} isExpanded={isExpanded} name={name} onToggle={onToggle}>
				{`{${entries.length} ${entries.length === 1 ? "key" : "keys"}}`}
			</ObjectNodeToggle>
			{isExpanded && (
				<div>
					{entries.map(([key, value]) => (
						<div key={key}>{renderChildNode(value, key, level + 1)}</div>
					))}
				</div>
			)}
		</div>
	);
};

const renderPrimitiveObjectNode = (data: unknown, name: string, indent: number): ReactNode => {
	if (data === null) {
		return (
			<PrimitiveObjectNode
				className="text-solarized-orange"
				indent={indent}
				name={name}
				value="null"
			/>
		);
	}

	if (data === undefined) {
		return (
			<PrimitiveObjectNode
				className="text-solarized-orange"
				indent={indent}
				name={name}
				value="undefined"
			/>
		);
	}

	if (typeof data === "string") {
		return (
			<PrimitiveObjectNode
				className="text-solarized-green"
				indent={indent}
				name={name}
				value={`"${data}"`}
			/>
		);
	}

	if (typeof data === "number" || typeof data === "boolean") {
		return (
			<PrimitiveObjectNode
				className="text-solarized-orange"
				indent={indent}
				name={name}
				value={String(data)}
			/>
		);
	}

	return null;
};

const ObjectNode = ({ data, name, level }: { data: unknown; name: string; level: number }) => {
	// Auto-expand first 2 levels.
	const [isExpanded, setIsExpanded] = useState(level < 2);
	const indent = level * 16;

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => !prev);
	}, []);
	const renderChildNode = useCallback(
		(childData: unknown, childName: string, childLevel: number) => (
			<ObjectNode data={childData} name={childName} level={childLevel} />
		),
		[],
	);

	const primitiveNode = renderPrimitiveObjectNode(data, name, indent);
	if (primitiveNode) {
		return primitiveNode;
	}

	if (Array.isArray(data)) {
		return (
			<ArrayObjectNode
				data={data}
				indent={indent}
				isExpanded={isExpanded}
				level={level}
				name={name}
				onToggle={toggleExpanded}
				renderChildNode={renderChildNode}
			/>
		);
	}

	if (typeof data === "object" && data !== null) {
		return (
			<RecordObjectNode
				data={data as Record<string, unknown>}
				indent={indent}
				isExpanded={isExpanded}
				level={level}
				name={name}
				onToggle={toggleExpanded}
				renderChildNode={renderChildNode}
			/>
		);
	}

	return (
		<PrimitiveObjectNode
			className="text-muted-foreground"
			indent={indent}
			name={name}
			value={String(data)}
		/>
	);
};

// Collapsible Object Display component for AST and renderable tree
const ObjectDisplay = ({ data }: { data: unknown }) => (
	<div className="font-mono text-xs">
		<ObjectNode data={data} name="" level={0} />
	</div>
);

interface FillInputsInputField {
	description?: string;
	label: string;
	options?: string[];
	type?: "string" | "number" | "date" | "switch" | "boolean";
	unit?: string;
}

const collectFillInputFields = (inputTags: InputTagType[]) => {
	const fields: FillInputsInputField[] = [];
	const seen = new Set<string>();

	const pushField = (
		label: string | undefined,
		description: string | undefined,
		type: FillInputsInputField["type"],
		options?: string[],
		unit?: string,
	) => {
		if (!label || seen.has(label)) {
			return;
		}

		fields.push({ description, label, options, type, unit });
		seen.add(label);
	};

	const visit = (input: InputTagType) => {
		if (input.name === "Info") {
			pushField(
				input.attributes.primary,
				input.attributes.description,
				input.attributes.type ?? "string",
				undefined,
				input.attributes.unit,
			);
			for (const child of input.children ?? []) {
				visit(child);
			}
			return;
		}

		if (input.name === "Switch") {
			const options = input.children
				?.filter((child) => child.name === "Case" && child.attributes.primary)
				.map((child) => child.attributes.primary);
			const type =
				input.attributes.type === "boolean" || input.attributes.type === "checkbox"
					? "boolean"
					: "switch";
			pushField(input.attributes.primary, undefined, type, options);
			for (const child of input.children ?? []) {
				visit(child);
			}
			return;
		}

		if (input.name === "Case" || input.name === "Score") {
			for (const child of input.children ?? []) {
				visit(child);
			}
		}
	};

	for (const inputTag of inputTags) {
		visit(inputTag);
	}

	return fields;
};

export default function PlaygroundPage() {
	const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

	const [values, setValues] = useState<Record<string, unknown>>({});
	const [useTipTap, setUseTipTap] = useState(false);
	const [middleView, setMiddleView] = useState<"inputs" | "inputTags" | "inputFields">("inputs");
	const [rightView, setRightView] = useState<"preview" | "ast" | "transform">("preview");

	// Handle values change from inputs
	const handleValuesChange = useCallback((data: Record<string, unknown>) => {
		setValues(data);
	}, []);

	const handleTemplateChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
		setTemplate(event.target.value);
	}, []);

	const handleResetTemplate = useCallback(() => {
		setTemplate(RESET_TEMPLATE);
	}, []);

	const handleShowInputView = useCallback(() => {
		setMiddleView("inputs");
	}, []);

	const handleShowInputTagsView = useCallback(() => {
		setMiddleView("inputTags");
	}, []);

	const handleShowInputFieldsView = useCallback(() => {
		setMiddleView("inputFields");
	}, []);

	const handleShowPreviewView = useCallback(() => {
		setRightView("preview");
	}, []);

	const handleShowTransformView = useCallback(() => {
		setRightView("transform");
	}, []);

	const handleShowAstView = useCallback(() => {
		setRightView("ast");
	}, []);

	// Parse markdoc to get input tags
	const parsedInputs = useMemo(() => parseMarkdocToInputs(template), [template]);
	const fillInputFields = useMemo(() => collectFillInputFields(parsedInputs), [parsedInputs]);

	// Markdoc parsing for AST and transform views
	const markdocData = useMemo(() => {
		try {
			const ast = Markdoc.parse(template);
			const content: RenderableTreeNode = Markdoc.transform(ast, config);
			return { ast, content };
		} catch (error) {
			console.error("Markdoc parsing error:", error);
			const errorAst = Markdoc.parse(`Error parsing template: ${error}`);
			return {
				ast: errorAst,
				content: Markdoc.transform(errorAst, config),
			};
		}
	}, [template]);

	const middleViewContent = (() => {
		if (middleView === "inputs") {
			if (parsedInputs.length > 0) {
				return (
					<div className="space-y-4">
						<Inputs inputTags={parsedInputs} onChange={handleValuesChange} />
					</div>
				);
			}

			return (
				<div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
					<Settings className="h-12 w-12" />
					<div className="space-y-2">
						<h3 className="font-semibold text-lg">Keine Eingaben gefunden</h3>
						<p className="max-w-sm text-sm">
							Fügen Sie info-Tags zu Ihrer Vorlage hinzu mit der Syntax:
							<br />
							<code className="rounded bg-muted px-2 py-1 text-xs">{`{% info "feldname" %}`}</code>
						</p>
					</div>
				</div>
			);
		}

		if (middleView === "inputTags") {
			return (
				<div className="h-full">
					{parsedInputs.length > 0 ? (
						<ObjectDisplay data={parsedInputs} />
					) : (
						<div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
							<Code className="h-12 w-12" />
							<div className="space-y-2">
								<h3 className="font-semibold text-lg">Keine InputTags zum Anzeigen</h3>
								<p className="max-w-sm text-sm">
									Fügen Sie info-Tags zu Ihrer Vorlage hinzu, um die InputTags zu sehen.
								</p>
							</div>
						</div>
					)}
				</div>
			);
		}

		return (
			<div className="h-full">
				{fillInputFields.length > 0 ? (
					<ObjectDisplay data={fillInputFields} />
				) : (
					<div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
						<Code className="h-12 w-12" />
						<div className="space-y-2">
							<h3 className="font-semibold text-lg">Keine InputFields zum Anzeigen</h3>
							<p className="max-w-sm text-sm">
								Fügen Sie info- oder switch-Tags hinzu, um die fillInputs-Felder zu sehen.
							</p>
						</div>
					</div>
				)}
			</div>
		);
	})();

	const rightViewTitle = (() => {
		if (rightView === "preview") {
			return "Gerenderte Ausgabe";
		}
		if (rightView === "ast") {
			return "AST";
		}
		return "Renderable Tree";
	})();

	return (
		<div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
			<div className="mx-auto max-w-full space-y-8">
				{/* Header Section */}
				<div className="space-y-4 text-center">
					<div className="flex items-center justify-center gap-3">
						<div className="rounded-full bg-solarized-cyan/10 p-3">
							<FileText className="h-8 w-8 text-solarized-cyan" />
						</div>
						<div>
							<h1 className="font-bold text-3xl text-primary">Markdoc-MD Playground</h1>
							<p className="text-lg text-muted-foreground">
								Testen und Vorschau Ihrer Markdoc-Vorlagen mit interaktiven Eingabefeldern
							</p>
						</div>
					</div>
				</div>

				{/* 3-Column Layout - Equal Sizes */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
					{/* Left Column - Template Input */}
					<div className="lg:col-span-1">
						<Card className="h-[680px] border-solarized-blue/20 shadow-lg">
							<CardHeader className="bg-gradient-to-r from-solarized-blue/5 to-solarized-cyan/5">
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2 text-base text-foreground">
										<FileText className="h-5 w-5 text-solarized-blue" />
										Vorlage Eingabe
									</CardTitle>
									<div className="flex items-center gap-2 text-sm">
										<span className={useTipTap ? "text-muted-foreground" : "text-foreground"}>
											Text
										</span>
										<Switch checked={useTipTap} onCheckedChange={setUseTipTap} />
										<span className={useTipTap ? "text-foreground" : "text-muted-foreground"}>
											Editor
										</span>
									</div>
								</div>
							</CardHeader>
							<CardContent className="p-4">
								<div className="h-[500px]">
									{useTipTap ? (
										<TipTap note={template} setContent={setTemplate} />
									) : (
										<Textarea
											placeholder="Geben Sie hier Ihre Markdoc-Vorlage mit info-Tags ein..."
											className="h-full resize-none border-input bg-background font-mono text-foreground text-sm transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
											value={template}
											onChange={handleTemplateChange}
										/>
									)}
								</div>
								<div className="mt-4 space-y-2">
									<Button
										variant="outline"
										size="sm"
										onClick={handleResetTemplate}
										className="w-full"
									>
										Vorlage zurücksetzen
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Middle Column - Inputs / InputTags / InputFields */}
					<div className="lg:col-span-1">
						<Card className="h-[680px] border-solarized-green/20 shadow-lg">
							<CardHeader className="bg-gradient-to-r from-solarized-green/5 to-solarized-blue/5">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<CardTitle className="flex items-center gap-2 text-base text-foreground">
										<Settings className="h-5 w-5 text-solarized-green" />
										Eingaben
									</CardTitle>
									<div className="flex items-center gap-1">
										<Button
											variant={middleView === "inputs" ? "default" : "outline"}
											size="sm"
											onClick={handleShowInputView}
											className="h-7 px-1.5 text-[11px] sm:h-8 sm:px-2 sm:text-xs"
										>
											<Settings className="mr-1 hidden h-3 w-3 sm:block" />
											Inputs
										</Button>
										<Button
											variant={middleView === "inputTags" ? "default" : "outline"}
											size="sm"
											onClick={handleShowInputTagsView}
											className="h-7 px-1.5 text-[11px] sm:h-8 sm:px-2 sm:text-xs"
										>
											<Code className="mr-1 hidden h-3 w-3 sm:block" />
											InputTags
										</Button>
										<Button
											variant={middleView === "inputFields" ? "default" : "outline"}
											size="sm"
											onClick={handleShowInputFieldsView}
											className="h-7 px-1.5 text-[11px] sm:h-8 sm:px-2 sm:text-xs"
										>
											<Code className="mr-1 hidden h-3 w-3 sm:block" />
											InputFields
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent className="p-4">
								<ScrollArea className="h-[552px] overflow-y-auto">{middleViewContent}</ScrollArea>
							</CardContent>
						</Card>
					</div>

					{/* Right Column - Preview / AST / Transform */}
					<div className="lg:col-span-1">
						<Card className="h-[680px] border-solarized-cyan/20 shadow-lg">
							<CardHeader className="bg-gradient-to-r from-solarized-cyan/5 to-solarized-green/5">
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2 text-base text-foreground">
										<Eye className="h-5 w-5 text-solarized-cyan" />
										{rightViewTitle}
									</CardTitle>
									<div className="flex items-center gap-1">
										<Button
											variant={rightView === "preview" ? "default" : "outline"}
											size="sm"
											onClick={handleShowPreviewView}
											className="h-8 px-2 text-xs"
										>
											<Eye className="mr-1 h-3 w-3" />
											Preview
										</Button>
										<Button
											variant={rightView === "transform" ? "default" : "outline"}
											size="sm"
											onClick={handleShowTransformView}
											className="h-8 px-2 text-xs"
										>
											<Layers className="mr-1 h-3 w-3" />
											Tree
										</Button>
										<Button
											variant={rightView === "ast" ? "default" : "outline"}
											size="sm"
											onClick={handleShowAstView}
											className="h-8 px-2 text-xs"
										>
											<TreePine className="mr-1 h-3 w-3" />
											AST
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent className="p-4">
								<ScrollArea className="h-[552px] rounded-lg border border-solarized-cyan/20 bg-background/50 p-4">
									{(() => {
										if (rightView === "preview") {
											if (!template) {
												return (
													<div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
														<Eye className="h-12 w-12" />
														<div className="space-y-2">
															<h3 className="font-semibold text-lg">Keine Vorlage</h3>
															<p className="max-w-sm text-sm">
																Geben Sie eine Markdoc-Vorlage in der linken Spalte ein, um die
																gerenderte Ausgabe hier zu sehen.
															</p>
														</div>
													</div>
												);
											}
											return (
												<MemoizedCopySection title="Vorschau" values={values} content={template} />
											);
										}

										if (rightView === "ast") {
											if (!template) {
												return (
													<div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
														<TreePine className="h-12 w-12" />
														<div className="space-y-2">
															<h3 className="font-semibold text-lg">Keine AST</h3>
															<p className="max-w-sm text-sm">
																Geben Sie eine Markdoc-Vorlage ein, um den Abstract Syntax Tree zu
																sehen.
															</p>
														</div>
													</div>
												);
											}
											return <ObjectDisplay data={markdocData.ast} />;
										}

										if (!template) {
											return (
												<div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
													<Layers className="h-12 w-12" />
													<div className="space-y-2">
														<h3 className="font-semibold text-lg">Kein Renderable Tree</h3>
														<p className="max-w-sm text-sm">
															Geben Sie eine Markdoc-Vorlage ein, um den renderable tree zu sehen.
														</p>
													</div>
												</div>
											);
										}
										return <ObjectDisplay data={markdocData.content} />;
									})()}
								</ScrollArea>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Info Section - Updated */}
				<div className="rounded-lg border border-solarized-blue/20 bg-solarized-blue/10 p-4 text-sm">
					<h4 className="mb-2 font-semibold text-solarized-blue">Verwendung:</h4>
					<ul className="space-y-1 text-solarized-blue/80">
						<li>• Schreiben Sie Ihre Markdoc-Vorlage mit info-Tags in der linken Spalte</li>
						<li>• Mittlere Spalte: Wechseln Sie zwischen Eingabefeldern und JSON-Darstellung</li>
						<li>• Rechte Spalte: Wechseln Sie zwischen Vorschau, AST und Renderable Tree</li>
						<li>
							• Info-Tag Syntax:{" "}
							<code className="rounded bg-solarized-blue/20 px-1">{`{% info "feld" /%}`}</code>
						</li>
						<li>
							• Switch-Tag Syntax:{" "}
							<code className="rounded bg-solarized-blue/20 px-1">{`{% switch "variable" %}...{% /switch %}`}</code>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
