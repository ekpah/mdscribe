"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Braces, DatabaseZap, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { formatFhirSourceValue, resolveFhirSource } from "./_lib/fhir-source";

const DEFAULT_SOURCE =
	"fhir://Observation?code=http://loinc.org|718-7&_sort=-date&_count=1#value.ofType(Quantity)";

const sourceDateFormatter = new Intl.DateTimeFormat("de-DE", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

const ResultRow = ({ label, value }: { label: string; value: string }) => (
	<div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 text-xs">
		<span className="text-solarized-base01">{label}</span>
		<span className="break-all font-medium text-solarized-base00">{value}</span>
	</div>
);

export const FhirSourceTester = ({ input }: { input: unknown }) => {
	const [source, setSource] = useState(DEFAULT_SOURCE);
	const resolution = useMemo(
		() => (source.trim() ? resolveFhirSource(input, source.trim()) : null),
		[input, source],
	);
	const formattedDate = resolution?.source.date
		? sourceDateFormatter.format(new Date(resolution.source.date))
		: (resolution?.source.dateLabel ?? "–");

	return (
		<div className="rounded-lg border border-solarized-base2 bg-solarized-base3/50">
			<div className="flex items-center gap-2 border-solarized-base2 border-b px-4 py-3">
				<DatabaseZap className="h-4 w-4 text-solarized-blue" />
				<div>
					<p className="font-medium text-solarized-base00 text-sm">FHIR Source testen</p>
					<p className="text-solarized-base01 text-xs">
						FHIR-Suche vor #, FHIRPath-Navigation danach
					</p>
				</div>
			</div>
			<div className="space-y-4 p-4">
				<div className="space-y-2">
					<Label htmlFor="fhir-source-query">Source</Label>
					<Input
						className="border-solarized-base2 bg-background font-mono text-xs"
						id="fhir-source-query"
						onChange={(event) => {
							setSource(event.target.value);
						}}
						placeholder="fhir://Observation?...#value.ofType(Quantity)"
						spellCheck={false}
						value={source}
					/>
				</div>

				<div className="space-y-2">
					<p className="font-medium text-solarized-base00 text-sm">Ergebnis</p>
					{resolution ? (
						<div className="space-y-3 rounded-md border border-solarized-green/30 bg-solarized-green/5 p-4">
							<div className="flex items-start gap-3">
								<Braces className="mt-0.5 h-4 w-4 shrink-0 text-solarized-green" />
								<code className="break-all font-semibold text-solarized-base00 text-sm">
									{formatFhirSourceValue(resolution.value)}
								</code>
							</div>
							<div className="space-y-1.5 border-solarized-base2 border-t pt-3">
								<ResultRow label="Datum" value={formattedDate} />
								<ResultRow label="Ressource" value={resolution.source.reference} />
								<ResultRow label="Bundle-Pfad" value={resolution.source.bundlePointer} />
								<div className="flex flex-wrap gap-2 pt-1">
									{resolution.source.code ? (
										<Badge variant="outline">Code {resolution.source.code}</Badge>
									) : null}
									{resolution.source.status ? (
										<Badge variant="outline">Status {resolution.source.status}</Badge>
									) : null}
								</div>
							</div>
						</div>
					) : (
						<div className="flex min-h-28 items-center gap-3 rounded-md border border-dashed border-solarized-base2 bg-background/60 p-4">
							<SearchX className="h-5 w-5 shrink-0 text-solarized-base1" />
							<div>
								<p className="font-medium text-solarized-base00 text-sm">Kein Ergebnis</p>
								<p className="text-solarized-base01 text-xs">
									Source, Filter oder FHIRPath passen zu keinem Wert im eingefügten FHIR.
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
