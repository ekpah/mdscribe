"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, KeyRound } from "lucide-react";

import { orpc } from "@/lib/orpc";

const formatDate = (iso: string | null): string => {
	if (!iso) {
		return "—";
	}
	return new Date(iso).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
	<div className="flex items-center justify-between gap-4 border-solarized-base2 border-b py-2 last:border-b-0">
		<span className="text-solarized-base01 text-sm">{label}</span>
		<span className="text-right font-medium text-solarized-base00 text-sm">{value}</span>
	</div>
);

export const LicensePageClient = () => {
	const { data, isLoading } = useQuery(orpc.admin.license.get.queryOptions());

	if (isLoading || !data) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto max-w-2xl space-y-4">
					<Skeleton className="h-40 w-full" />
				</div>
			</div>
		);
	}

	const seatLabel =
		data.maxSeats === null
			? `${data.seatCount} (unbegrenzt)`
			: `${data.seatCount} / ${data.maxSeats}`;

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-2xl space-y-4">
				<Card className="border-solarized-base2">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<KeyRound className="h-5 w-5 text-solarized-blue" />
								<CardTitle className="text-solarized-base00">Lizenz</CardTitle>
							</div>
							{data.isConfigured ? (
								<Badge variant={data.edition === "licensed" ? "default" : "secondary"}>
									{data.edition === "licensed" ? "Lizenziert" : "Community"}
								</Badge>
							) : (
								<Badge variant="secondary">Community</Badge>
							)}
						</div>
						<CardDescription className="text-solarized-base01">
							{data.isConfigured
								? "Diese Installation wird über einen offline geprüften Lizenzschlüssel freigeschaltet."
								: "Keine Lizenz konfiguriert. MDScribe läuft in der kostenlosen Community-Konfiguration."}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{data.isExpired ? (
							<div className="flex items-start gap-2 rounded-md bg-solarized-yellow/10 p-3 text-solarized-base00 text-sm">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-solarized-yellow" />
								<span>
									Die Lizenz ist abgelaufen. Die Anwendung funktioniert weiterhin vollständig; bitte
									erneuere den Lizenzschlüssel.
								</span>
							</div>
						) : null}
						{data.isNotYetValid ? (
							<div className="flex items-start gap-2 rounded-md bg-solarized-yellow/10 p-3 text-solarized-base00 text-sm">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-solarized-yellow" />
								<span>
									Der Lizenzschlüssel ist noch nicht gültig (Startdatum liegt in der Zukunft).
								</span>
							</div>
						) : null}
						{data.maxSeats !== null && !data.seatsAvailable ? (
							<div className="flex items-start gap-2 rounded-md bg-solarized-yellow/10 p-3 text-solarized-base00 text-sm">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-solarized-yellow" />
								<span>
									Das Nutzerlimit ist erreicht. Bestehende Nutzer bleiben aktiv; neue
									Registrierungen werden blockiert.
								</span>
							</div>
						) : null}

						<div>
							<Row label="Lizenznehmer" value={data.licensee ?? "—"} />
							<Row label="Nutzer (Sitze)" value={seatLabel} />
							<Row label="Ausgestellt am" value={formatDate(data.issuedAt)} />
							<Row
								label="Gültig bis"
								value={data.expiresAt ? formatDate(data.expiresAt) : "Unbegrenzt"}
							/>
							<Row
								label="Funktionen"
								value={data.features.length > 0 ? data.features.join(", ") : "—"}
							/>
						</div>

						<p className="text-solarized-base01 text-xs">
							Der Lizenzschlüssel wird über die Umgebungsvariable{" "}
							<code className="rounded bg-solarized-base2 px-1 py-0.5">MDSCRIBE_LICENSE_KEY</code>{" "}
							gesetzt und vollständig offline geprüft.
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
