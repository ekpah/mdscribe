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
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import type { ChartConfig } from "@repo/design-system/components/ui/chart";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { AlertCircle, Braces, ChartNoAxesCombined, FlaskConical, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { parseFhirTrends } from "./_lib/fhir-observations";
import type { FhirTrendSeries } from "./_lib/fhir-observations";
import { FhirSourceTester } from "./fhir-source-tester";

const SAMPLE_FHIR = `{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Observation",
        "id": "hba1c-1",
        "status": "final",
        "code": {
          "coding": [{ "system": "http://loinc.org", "code": "4548-4", "display": "HbA1c" }],
          "text": "HbA1c"
        },
        "effectiveDateTime": "2025-01-15T09:00:00Z",
        "valueQuantity": { "value": 7.4, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" }
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "hba1c-2",
        "status": "final",
        "code": {
          "coding": [{ "system": "http://loinc.org", "code": "4548-4", "display": "HbA1c" }],
          "text": "HbA1c"
        },
        "effectiveDateTime": "2025-04-16T09:00:00Z",
        "valueQuantity": { "value": 6.9, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" }
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "hba1c-3",
        "status": "final",
        "code": {
          "coding": [{ "system": "http://loinc.org", "code": "4548-4", "display": "HbA1c" }],
          "text": "HbA1c"
        },
        "effectiveDateTime": "2025-07-17T09:00:00Z",
        "valueQuantity": { "value": 6.5, "unit": "%", "system": "http://unitsofmeasure.org", "code": "%" }
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "hb-1",
        "status": "final",
        "meta": { "source": "urn:mdscribe:example-laboratory" },
        "code": {
          "coding": [{ "system": "http://loinc.org", "code": "718-7", "display": "Hemoglobin" }],
          "text": "Hämoglobin (Hb)"
        },
        "subject": { "reference": "Patient/example" },
        "effectiveDateTime": "2025-01-15T09:00:00Z",
        "valueQuantity": { "value": 12.8, "unit": "g/dL", "system": "http://unitsofmeasure.org", "code": "g/dL" }
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "hb-2",
        "status": "final",
        "meta": { "source": "urn:mdscribe:example-laboratory" },
        "code": {
          "coding": [{ "system": "http://loinc.org", "code": "718-7", "display": "Hemoglobin" }],
          "text": "Hämoglobin (Hb)"
        },
        "subject": { "reference": "Patient/example" },
        "effectiveDateTime": "2025-07-17T09:00:00Z",
        "valueQuantity": { "value": 13.4, "unit": "g/dL", "system": "http://unitsofmeasure.org", "code": "g/dL" }
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "creatinine-1",
        "status": "final",
        "code": {
          "coding": [{ "system": "http://loinc.org", "code": "2160-0", "display": "Creatinine" }],
          "text": "Kreatinin"
        },
        "effectiveDateTime": "2025-01-15T09:00:00Z",
        "valueQuantity": { "value": 1.08, "unit": "mg/dL", "system": "http://unitsofmeasure.org", "code": "mg/dL" }
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "creatinine-2",
        "status": "final",
        "code": {
          "coding": [{ "system": "http://loinc.org", "code": "2160-0", "display": "Creatinine" }],
          "text": "Kreatinin"
        },
        "effectiveDateTime": "2025-07-17T09:00:00Z",
        "valueQuantity": { "value": 0.92, "unit": "mg/dL", "system": "http://unitsofmeasure.org", "code": "mg/dL" }
      }
    },
    {
      "fullUrl": "http://epa4all/epa/medication/api/v1/fhir/Medication/2d5a0317-b2df-4d7b-ad72-07f5f66f9f12",
      "resource": {
        "resourceType": "Medication",
        "id": "2d5a0317-b2df-4d7b-ad72-07f5f66f9f12",
        "meta": {
          "profile": ["https://gematik.de/fhir/epa-medication/StructureDefinition/epa-medication"]
        },
        "extension": [
          {
            "url": "https://gematik.de/fhir/epa-medication/StructureDefinition/rx-prescription-process-identifier-extension",
            "valueIdentifier": {
              "system": "https://gematik.de/fhir/epa-medication/sid/rx-prescription-process-identifier",
              "value": "160.153.303.260.460_202508220"
            }
          }
        ],
        "code": {
          "coding": [
            {
              "system": "http://fhir.de/CodeSystem/ifa/pzn",
              "code": "03953522",
              "display": "Metoprolol-ratiopharm® 100 mg Tabletten"
            },
            {
              "system": "http://fhir.de/CodeSystem/bfarm/atc",
              "code": "C07AB02",
              "display": "Metoprolol"
            }
          ]
        },
        "status": "active",
        "form": {
          "coding": [{ "code": "TAB", "display": "Tabletten" }]
        },
        "amount": {
          "numerator": { "value": 100, "unit": "MilliGram", "code": "mg" },
          "denominator": { "value": 1, "unit": "Tablet", "code": "{Tablet}" }
        }
      }
    }
  ]
}`;

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

const axisDateFormatter = new Intl.DateTimeFormat("de-DE", {
	day: "2-digit",
	month: "2-digit",
	year: "2-digit",
});

const formatValue = (value: number, unit: string | null): string =>
	`${value.toLocaleString("de-DE", { maximumFractionDigits: 4 })}${unit ? ` ${unit}` : ""}`;

const getSeriesLabel = (series: FhirTrendSeries): string =>
	`${series.label}${series.unit ? ` (${series.unit})` : ""}`;

const SeriesSummary = ({ series }: { series: FhirTrendSeries }) => {
	const datedPoints = series.points.filter(
		(point): point is typeof point & { date: number } => point.date !== null,
	);
	const values = series.points.map((point) => point.value);
	const latestPoint = datedPoints.at(-1) ?? series.points.at(-1);
	const minimum = values.length ? Math.min(...values) : null;
	const maximum = values.length ? Math.max(...values) : null;

	return (
		<div className="grid grid-cols-3 gap-2">
			<div className="rounded-lg border border-solarized-base2 bg-solarized-base3/60 p-3">
				<p className="text-solarized-base01 text-xs">Letzter Wert</p>
				<p className="mt-1 font-semibold text-solarized-base00 text-sm">
					{latestPoint ? formatValue(latestPoint.value, series.unit) : "–"}
				</p>
			</div>
			<div className="rounded-lg border border-solarized-base2 bg-solarized-base3/60 p-3">
				<p className="text-solarized-base01 text-xs">Minimum</p>
				<p className="mt-1 font-semibold text-solarized-base00 text-sm">
					{minimum === null ? "–" : formatValue(minimum, series.unit)}
				</p>
			</div>
			<div className="rounded-lg border border-solarized-base2 bg-solarized-base3/60 p-3">
				<p className="text-solarized-base01 text-xs">Maximum</p>
				<p className="mt-1 font-semibold text-solarized-base00 text-sm">
					{maximum === null ? "–" : formatValue(maximum, series.unit)}
				</p>
			</div>
		</div>
	);
};

const TrendChart = ({ series }: { series: FhirTrendSeries }) => {
	const data = series.points.filter(
		(point): point is typeof point & { date: number } => point.date !== null,
	);
	const chartConfig = {
		value: {
			color: "var(--solarized-blue)",
			label: getSeriesLabel(series),
		},
	} satisfies ChartConfig;

	if (data.length < 2) {
		return (
			<div className="flex min-h-[340px] flex-col items-center justify-center rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/40 px-6 text-center">
				<ChartNoAxesCombined className="mb-3 h-8 w-8 text-solarized-base1" />
				<p className="font-medium text-solarized-base00">Noch kein zeitlicher Verlauf</p>
				<p className="mt-1 max-w-md text-solarized-base01 text-sm">
					Für eine Trendlinie werden mindestens zwei Messungen mit gültigem FHIR-Datum benötigt.
				</p>
			</div>
		);
	}

	return (
		<ChartContainer className="h-[390px] w-full" config={chartConfig}>
			<LineChart accessibilityLayer data={data} margin={{ left: 4, right: 18, top: 16 }}>
				<CartesianGrid vertical={false} />
				<XAxis
					axisLine={false}
					dataKey="date"
					domain={["dataMin", "dataMax"]}
					minTickGap={34}
					scale="time"
					tickFormatter={(value: number) => axisDateFormatter.format(new Date(value))}
					tickLine={false}
					tickMargin={10}
					type="number"
				/>
				<YAxis
					axisLine={false}
					domain={["auto", "auto"]}
					tickFormatter={(value: number) =>
						value.toLocaleString("de-DE", { maximumFractionDigits: 3 })
					}
					tickLine={false}
					tickMargin={8}
					width={54}
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={(label) =>
								label === undefined ? "" : dateFormatter.format(new Date(Number(label)))
							}
							valueFormatter={(value) => {
								const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
								return Number.isFinite(numericValue) ? formatValue(numericValue, series.unit) : "–";
							}}
						/>
					}
				/>
				<Line
					activeDot={{ r: 5 }}
					dataKey="value"
					dot={{ fill: "var(--color-value)", r: 4 }}
					stroke="var(--color-value)"
					strokeWidth={2.5}
					type="monotone"
				/>
			</LineChart>
		</ChartContainer>
	);
};

export const FhirPlaygroundClient = () => {
	const [source, setSource] = useState(SAMPLE_FHIR);
	const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
	const parsed = useMemo(() => {
		try {
			const input = JSON.parse(source) as unknown;
			return { error: null, input, result: parseFhirTrends(input) };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : "Das JSON konnte nicht gelesen werden.",
				input: null,
				result: null,
			};
		}
	}, [source]);
	const selectedSeries = useMemo(() => {
		if (!parsed.result) {
			return null;
		}
		return (
			parsed.result.series.find((series) => series.key === selectedSeriesKey) ??
			parsed.result.series[0] ??
			null
		);
	}, [parsed.result, selectedSeriesKey]);

	return (
		<div className="grid min-h-[680px] gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.35fr)]">
			<Card className="flex min-h-0 flex-col border-solarized-base2">
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between gap-3">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base text-solarized-base00">
								<Braces className="h-4 w-4 text-solarized-blue" />
								FHIR JSON
							</CardTitle>
							<CardDescription>
								Bundle, einzelne Observation oder Array einfügen. Die Auswertung aktualisiert sich
								sofort.
							</CardDescription>
						</div>
						<Button
							onClick={() => {
								setSource(SAMPLE_FHIR);
								setSelectedSeriesKey(null);
							}}
							size="sm"
							type="button"
							variant="outline"
						>
							<RotateCcw className="h-3.5 w-3.5" />
							Beispiel
						</Button>
					</div>
				</CardHeader>
				<CardContent className="flex min-h-0 flex-1 flex-col gap-3">
					<Textarea
						aria-label="FHIR JSON"
						className="min-h-[560px] flex-1 resize-y border-solarized-base2 bg-solarized-base3 font-mono text-solarized-base00 text-xs leading-relaxed focus:border-solarized-blue focus:ring-solarized-blue/20"
						onChange={(event) => {
							setSource(event.target.value);
						}}
						placeholder='{"resourceType":"Bundle","entry":[...]}'
						spellCheck={false}
						value={source}
					/>
					{parsed.error ? (
						<Alert variant="destructive">
							<AlertCircle />
							<AlertDescription>Ungültiges JSON: {parsed.error}</AlertDescription>
						</Alert>
					) : (
						<div className="flex flex-wrap items-center gap-2 text-solarized-base01 text-xs">
							<Badge variant="outline">{parsed.result?.resourceCount ?? 0} Ressourcen</Badge>
							<Badge variant="outline">{parsed.result?.observationCount ?? 0} Observations</Badge>
							<Badge variant="outline">{parsed.result?.series.length ?? 0} Laborwerte</Badge>
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="flex min-h-0 flex-col border-solarized-base2">
				<CardHeader className="space-y-4 pb-3">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2 text-base text-solarized-base00">
							<ChartNoAxesCombined className="h-4 w-4 text-solarized-blue" />
							Laborwert-Verlauf
						</CardTitle>
						<CardDescription>
							Numerische Observation-Werte und Komponenten werden automatisch erkannt.
						</CardDescription>
					</div>
					<div className="space-y-2">
						<Label htmlFor="fhir-lab-value">Laborwert</Label>
						<Select
							disabled={!parsed.result?.series.length}
							onValueChange={(value) => {
								setSelectedSeriesKey(value);
							}}
							value={selectedSeries?.key ?? undefined}
						>
							<SelectTrigger
								className="w-full border-solarized-base2 bg-solarized-base3"
								id="fhir-lab-value"
							>
								<SelectValue placeholder="Keine Laborwerte gefunden" />
							</SelectTrigger>
							<SelectContent>
								{parsed.result?.series.map((series) => (
									<SelectItem key={series.key} value={series.key}>
										{getSeriesLabel(series)} · {series.points.length} Messungen
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent className="flex flex-1 flex-col gap-4">
					<FhirSourceTester input={parsed.input} />
					{selectedSeries ? (
						<>
							<div className="flex flex-wrap items-center gap-2">
								<Badge className="bg-solarized-blue/10 text-solarized-blue hover:bg-solarized-blue/10">
									{selectedSeries.label}
								</Badge>
								{selectedSeries.code ? (
									<Badge variant="outline">Code {selectedSeries.code}</Badge>
								) : null}
								<Badge variant="outline">{selectedSeries.points.length} Messungen</Badge>
								{selectedSeries.undatedPointCount ? (
									<Badge variant="outline">{selectedSeries.undatedPointCount} ohne Datum</Badge>
								) : null}
							</div>
							<SeriesSummary series={selectedSeries} />
							<TrendChart series={selectedSeries} />
						</>
					) : (
						<div className="flex min-h-[470px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/40 px-6 text-center">
							<FlaskConical className="mb-3 h-9 w-9 text-solarized-base1" />
							<p className="font-medium text-solarized-base00">
								{parsed.error ? "FHIR JSON korrigieren" : "Keine numerischen Laborwerte gefunden"}
							</p>
							<p className="mt-1 max-w-md text-solarized-base01 text-sm">
								{parsed.error
									? "Sobald das JSON gültig ist, erscheinen erkannte Laborwerte hier."
									: "Erkannt werden Observation.valueQuantity, numerische value[x]-Felder und Observation.component-Werte."}
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};
