"use client";

import { Alert, AlertDescription } from "@repo/design-system/components/ui/alert";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { SearchableSelect } from "@repo/design-system/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type {
	InfoInputTagType,
	InspectedMarkdocSource,
	InspectedMarkdocSources,
	SwitchInputTagType,
} from "@repo/markdoc-md";
import {
	analyzeMarkdocTemplate,
	DynamicMarkdocRenderer,
	inspectMarkdocSources,
} from "@repo/markdoc-md";
import {
	AlertCircle,
	Braces,
	Download,
	Loader2,
	RotateCcw,
	UserRound,
	Waypoints,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { createPatientEverythingUrl, extractPatientOptions } from "./_lib/fhir-patients";
import { fetchFhirBundlePages, fetchFhirJson } from "./_lib/fhir-url";
import { EPA_SAMPLE_FHIR } from "./_lib/sample-fhir";

const getErrorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error ? error.message : fallback;

const MOCK_PATIENT_SEARCH_URL =
	"https://api.mock.health/v/cluster/epic-cluster-A/open/fhir/r4/Patient?_count=5&_format=json";
const LATEST_HEMOGLOBIN_FHIRPATH =
	"Observation" +
	".where(code.coding.code = '718-7' and value is Quantity)" +
	".sort(effectiveDateTime).last().value.value";
const LATEST_HEMOGLOBIN_INFO_TAG = `{% info "hemoglobin" source=${JSON.stringify(`fhir://${LATEST_HEMOGLOBIN_FHIRPATH}`)} /%}`;

type SourcedInputTag = InfoInputTagType | SwitchInputTagType;

const getSourceTags = (markdoc: string): { error: string | null; inputs: SourcedInputTag[] } => {
	try {
		const analysis = analyzeMarkdocTemplate(markdoc);
		if (analysis.diagnostics.length > 0) {
			return {
				error: "Die Markdoc-Tags enthalten widersprüchliche Attribute.",
				inputs: [],
			};
		}
		if (
			analysis.inputs.length === 0 ||
			analysis.inputs.some((input) => input.name !== "Info" && input.name !== "Switch")
		) {
			return {
				error: "Der Playground unterstützt aktuell Info- und Switch-Tags.",
				inputs: [],
			};
		}
		return { error: null, inputs: analysis.inputs as SourcedInputTag[] };
	} catch (error) {
		return {
			error: getErrorMessage(error, "Der Markdoc-Tag konnte nicht gelesen werden."),
			inputs: [],
		};
	}
};

const formatFilteredResult = (results: unknown[]): string => {
	const displayedResult = results.length === 1 ? results[0] : results;
	return JSON.stringify(displayedResult, null, 2) ?? String(displayedResult);
};

const FilteredResult = ({ inspectedSource }: { inspectedSource: InspectedMarkdocSource }) => (
	<div className="space-y-2">
		<div className="flex items-center justify-between gap-3">
			<code className="min-w-0 truncate text-solarized-base01 text-xs">
				{inspectedSource.source}
			</code>
			<Badge className="shrink-0" variant="outline">
				{inspectedSource.results.length}
			</Badge>
		</div>
		<pre className="max-h-[360px] min-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-solarized-base00 text-xs">
			{formatFilteredResult(inspectedSource.results)}
		</pre>
	</div>
);

const FilteredResults = ({ sources }: { sources: InspectedMarkdocSource[] }) => {
	if (sources.length === 0) {
		return (
			<p className="rounded-md border border-dashed border-solarized-base2 p-4 text-solarized-base01 text-sm">
				Kein FHIRPath-Ergebnis verfügbar.
			</p>
		);
	}
	if (sources.length === 1 && sources[0]) {
		return <FilteredResult inspectedSource={sources[0]} />;
	}

	return (
		<Tabs defaultValue="source-0">
			<TabsList className="max-w-full justify-start overflow-x-auto">
				{sources.map((inspectedSource, index) => (
					<TabsTrigger key={`${inspectedSource.primary}-${index}`} value={`source-${index}`}>
						{inspectedSource.primary}
					</TabsTrigger>
				))}
			</TabsList>
			{sources.map((inspectedSource, index) => (
				<TabsContent
					className="mt-1 data-hidden:hidden"
					key={`${inspectedSource.primary}-${index}`}
					value={`source-${index}`}
				>
					<FilteredResult inspectedSource={inspectedSource} />
				</TabsContent>
			))}
		</Tabs>
	);
};

export const FhirPlaygroundClient = () => {
	const [source, setSource] = useState(EPA_SAMPLE_FHIR);
	const [patientSearchSource, setPatientSearchSource] = useState(EPA_SAMPLE_FHIR);
	const [markdocSource, setMarkdocSource] = useState(LATEST_HEMOGLOBIN_INFO_TAG);
	const [fhirUrl, setFhirUrl] = useState(MOCK_PATIENT_SEARCH_URL);
	const [fhirUrlError, setFhirUrlError] = useState<string | null>(null);
	const [isLoadingFhirUrl, setIsLoadingFhirUrl] = useState(false);
	const [isLoadingPatient, setIsLoadingPatient] = useState(false);
	const [patientError, setPatientError] = useState<string | null>(null);
	const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
	const deferredMarkdocSource = useDeferredValue(markdocSource);
	const patientOptions = useMemo(() => {
		try {
			return extractPatientOptions(JSON.parse(patientSearchSource) as unknown).map((patient) => ({
				...patient,
				keywords: [patient.id, patient.birthDate, patient.gender, ...patient.identifiers].filter(
					(value): value is string => typeof value === "string",
				),
				value: patient.id,
			}));
		} catch {
			return [];
		}
	}, [patientSearchSource]);
	const parsed = useMemo(() => {
		try {
			return { error: null, input: JSON.parse(source) as unknown };
		} catch (error) {
			return {
				error: getErrorMessage(error, "Das JSON konnte nicht gelesen werden."),
				input: null,
			};
		}
	}, [source]);
	const markdoc = useMemo(() => getSourceTags(deferredMarkdocSource), [deferredMarkdocSource]);
	const inspection = useMemo<InspectedMarkdocSources>(() => {
		if (parsed.error || parsed.input === null || markdoc.error) {
			return { diagnostics: [], sources: [], values: {} };
		}
		try {
			return inspectMarkdocSources(deferredMarkdocSource, { fhir: parsed.input });
		} catch (error) {
			return {
				diagnostics: [
					{
						code: "evaluation-error" as const,
						message: getErrorMessage(
							error,
							"Die Markdoc-Sources konnten nicht ausgewertet werden.",
						),
						primary: markdoc.inputs[0]?.attributes.primary ?? "",
						source: markdoc.inputs[0]?.attributes.source ?? "",
					},
				],
				sources: [],
				values: {},
			};
		}
	}, [deferredMarkdocSource, markdoc.error, markdoc.inputs, parsed.error, parsed.input]);
	const hasUnrenderableResult = inspection.sources.some(
		(inspectedSource) => inspectedSource.value === undefined,
	);
	const loadFhirUrl = async () => {
		setFhirUrlError(null);
		setIsLoadingFhirUrl(true);
		try {
			const nextSource = await fetchFhirJson(fhirUrl);
			setPatientSearchSource(nextSource);
			setSource(nextSource);
			setSelectedPatientId(null);
			setPatientError(null);
		} catch (error) {
			setFhirUrlError(getErrorMessage(error, "FHIR-Daten konnten nicht geladen werden."));
		} finally {
			setIsLoadingFhirUrl(false);
		}
	};
	const loadPatient = async (patientId: string) => {
		const patient = patientOptions.find((option) => option.id === patientId);
		if (!patient) {
			return;
		}
		setPatientError(null);
		setIsLoadingPatient(true);
		try {
			const patientUrl = createPatientEverythingUrl(fhirUrl, patient);
			setSource(await fetchFhirBundlePages(patientUrl));
			setSelectedPatientId(patientId);
		} catch (error) {
			setPatientError(
				getErrorMessage(error, "Der FHIR-Kontext des Patienten konnte nicht geladen werden."),
			);
		} finally {
			setIsLoadingPatient(false);
		}
	};

	return (
		<div className="grid min-h-[680px] gap-4 xl:grid-cols-2">
			<Card className="flex min-h-0 flex-col border-solarized-base2">
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between gap-3">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base text-solarized-base00">
								<Braces className="h-4 w-4 text-solarized-blue" />
								FHIR JSON
							</CardTitle>
							<CardDescription>FHIR-Antwort laden oder JSON direkt bearbeiten.</CardDescription>
						</div>
						<Button
							onClick={() => {
								setSource(EPA_SAMPLE_FHIR);
								setPatientSearchSource(EPA_SAMPLE_FHIR);
								setFhirUrlError(null);
								setPatientError(null);
								setSelectedPatientId(null);
							}}
							size="sm"
							type="button"
							variant="outline"
						>
							<RotateCcw className="h-3.5 w-3.5" />
							ePA-Beispiel
						</Button>
					</div>
				</CardHeader>
				<CardContent className="flex min-h-0 flex-1 flex-col gap-3">
					<form
						className="space-y-2"
						onSubmit={(event) => {
							event.preventDefault();
							void loadFhirUrl();
						}}
					>
						<Label htmlFor="fhir-request-url">FHIR-Request-URL</Label>
						<div className="flex gap-2">
							<Input
								aria-describedby="fhir-request-url-help"
								autoComplete="off"
								className="min-w-0 border-solarized-base2 bg-background font-mono text-xs"
								id="fhir-request-url"
								onChange={(event) => {
									setFhirUrl(event.target.value);
									setFhirUrlError(null);
								}}
								placeholder="https://hapi.fhir.org/baseR4/Patient?_count=10"
								spellCheck={false}
								type="url"
								value={fhirUrl}
							/>
							<Button
								disabled={!fhirUrl.trim() || isLoadingFhirUrl}
								type="submit"
								variant="outline"
							>
								{isLoadingFhirUrl ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Download className="h-4 w-4" />
								)}
								Laden
							</Button>
						</div>
						<p className="text-solarized-base01 text-xs" id="fhir-request-url-help">
							Vollständige GET-URL; der Testserver muss Browserzugriffe per CORS erlauben.
						</p>
					</form>
					{fhirUrlError ? (
						<Alert variant="destructive">
							<AlertCircle />
							<AlertDescription>{fhirUrlError}</AlertDescription>
						</Alert>
					) : null}
					<div className="flex items-center justify-between gap-3">
						<Label htmlFor="fhir-json-source">Abgerufenes FHIR JSON</Label>
						<Badge variant="outline">
							{selectedPatientId ? "Patientenkontext" : "Patientensuche"}
						</Badge>
					</div>
					<Textarea
						aria-label="FHIR JSON"
						className="min-h-[520px] flex-1 resize-y border-solarized-base2 bg-solarized-base3 font-mono text-solarized-base00 text-xs leading-relaxed"
						id="fhir-json-source"
						onChange={(event) => {
							setSource(event.target.value);
							if (!selectedPatientId) {
								setPatientSearchSource(event.target.value);
							}
						}}
						spellCheck={false}
						value={source}
					/>
					{parsed.error ? (
						<Alert variant="destructive">
							<AlertCircle />
							<AlertDescription>Ungültiges JSON: {parsed.error}</AlertDescription>
						</Alert>
					) : (
						<Badge className="w-fit" variant="outline">
							FHIR JSON gültig
						</Badge>
					)}
				</CardContent>
			</Card>

			<Card className="flex min-h-0 flex-col border-solarized-base2">
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between gap-3">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base text-solarized-base00">
								<Waypoints className="h-4 w-4 text-solarized-blue" />
								Markdoc FHIR Source
							</CardTitle>
							<CardDescription>
								Info- oder Switch-Tags definieren, auswerten und rendern.
							</CardDescription>
						</div>
						<Button
							onClick={() => {
								setMarkdocSource(LATEST_HEMOGLOBIN_INFO_TAG);
							}}
							size="sm"
							type="button"
							variant="outline"
						>
							<RotateCcw className="h-3.5 w-3.5" />
							Hb-Beispiel
						</Button>
					</div>
				</CardHeader>
				<CardContent className="flex flex-1 flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor="fhir-patient-select">Patient</Label>
						<SearchableSelect
							disabled={patientOptions.length === 0}
							emptyMessage="Keine Patienten in der geladenen FHIR-Antwort gefunden."
							id="fhir-patient-select"
							isLoading={isLoadingPatient}
							loadingMessage="Patientenkontext wird geladen..."
							onValueChange={(patientId) => {
								void loadPatient(patientId);
							}}
							options={patientOptions}
							placeholder={
								patientOptions.length
									? `${patientOptions.length} Patienten verfügbar`
									: "Zuerst eine Patientensuche laden"
							}
							renderOption={(patient) => (
								<div className="min-w-0">
									<span className="block truncate font-medium">{patient.label}</span>
									<span className="block truncate text-muted-foreground text-xs">
										{[patient.birthDate, patient.gender, patient.id].filter(Boolean).join(" · ")}
									</span>
								</div>
							)}
							renderSelected={(patient) =>
								patient ? (
									<div className="flex min-w-0 items-center gap-2">
										<UserRound className="h-4 w-4 shrink-0 text-solarized-blue" />
										<span className="truncate">{patient.label}</span>
										{patient.birthDate ? (
											<span className="shrink-0 text-muted-foreground">{patient.birthDate}</span>
										) : null}
									</div>
								) : null
							}
							searchPlaceholder="Patient nach Name, Geburtsdatum oder ID suchen..."
							value={selectedPatientId}
						/>
						<p className="text-solarized-base01 text-xs">
							Die Auswahl lädt Patient/$everything und verwendet das zusammengeführte Bundle als
							FHIRPath-Kontext.
						</p>
					</div>

					{patientError ? (
						<Alert variant="destructive">
							<AlertCircle />
							<AlertDescription>{patientError}</AlertDescription>
						</Alert>
					) : null}

					<div className="space-y-2">
						<Label htmlFor="markdoc-info-source">Markdoc-Tags</Label>
						<Textarea
							className="min-h-44 resize-y border-solarized-base2 bg-solarized-base3 font-mono text-solarized-base00 text-xs leading-relaxed"
							id="markdoc-info-source"
							onChange={(event) => {
								setMarkdocSource(event.target.value);
							}}
							spellCheck={false}
							value={markdocSource}
						/>
						<p className="text-solarized-base01 text-xs">
							Info- und Switch-Tags werden gemeinsam ausgewertet. Der Wert in
							source=&quot;fhir://...&quot; wird als FHIRPath gegen die Ressourcen-Collection des
							Bundles ausgewertet.
						</p>
					</div>

					{markdoc.error ? (
						<Alert variant="destructive">
							<AlertCircle />
							<AlertDescription>{markdoc.error}</AlertDescription>
						</Alert>
					) : null}

					{inspection.diagnostics.length > 0 ? (
						<Alert variant="destructive">
							<AlertCircle />
							<AlertDescription>
								{inspection.diagnostics.map((diagnostic) => diagnostic.message).join(" ")}
							</AlertDescription>
						</Alert>
					) : null}

					<div className="space-y-3 rounded-lg border border-solarized-base2 bg-background p-4">
						<div className="flex items-center justify-between gap-3">
							<p className="font-medium text-solarized-base00 text-sm">Gerenderte Markdoc-Tags</p>
							{markdoc.inputs.length > 0 ? (
								<Badge variant="outline">{markdoc.inputs.length} Tags</Badge>
							) : null}
						</div>
						{markdoc.inputs.length > 0 ? (
							<DynamicMarkdocRenderer
								className="min-h-10 rounded-md border border-dashed border-solarized-base2 p-3 text-sm"
								markdocContent={deferredMarkdocSource}
								variables={inspection.values}
							/>
						) : (
							<p className="text-solarized-base01 text-sm">Keine gültigen Markdoc-Tags.</p>
						)}
						{markdoc.inputs.length > 0 && hasUnrenderableResult ? (
							<p className="text-solarized-base01 text-xs">
								Nur einzelne Text-, Zahlen- oder Boolean-Werte können als Tag-Wert gerendert werden.
								Das vollständige gefilterte Ergebnis bleibt unten sichtbar.
							</p>
						) : null}
					</div>

					<div className="space-y-3 rounded-lg border border-solarized-base2 bg-solarized-base3/40 p-4">
						<div className="flex items-center justify-between gap-3">
							<p className="font-medium text-solarized-base00 text-sm">Ergebnis</p>
							<Badge variant="outline">{inspection.sources.length}</Badge>
						</div>
						<FilteredResults sources={inspection.sources} />
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
