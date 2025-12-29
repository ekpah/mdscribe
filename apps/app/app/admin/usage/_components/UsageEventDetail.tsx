"use client";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import type { Prisma } from "@repo/database";

type UsageEventWithUser = Prisma.UsageEventGetPayload<{
	include: { user: { select: { id: true; name: true; email: true } } };
}>;

interface UsageEventDetailProps {
	event: UsageEventWithUser | null | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function StatBox({ label, value }: { label: string; value: number | null }) {
	return (
		<div className="rounded-lg border border-solarized-base2 bg-solarized-base3 p-2">
			<p className="text-xs text-solarized-base01">{label}</p>
			<p className="font-mono text-sm text-solarized-base00">
				{value?.toLocaleString("de-DE") ?? "-"}
			</p>
		</div>
	);
}

function formatDate(date: Date | string) {
	const dateObj = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("de-DE", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(dateObj);
}

export function UsageEventDetail({
	event,
	open,
	onOpenChange,
}: UsageEventDetailProps) {
	if (!event) return null;

	const cost = event.cost ? Number(event.cost) : null;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full overflow-y-auto sm:max-w-lg"
			>
				<SheetHeader>
					<SheetTitle>Event-Details</SheetTitle>
					<SheetDescription>{formatDate(event.timestamp)}</SheetDescription>
				</SheetHeader>

				<div className="mt-6 space-y-6">
					{/* User Info Section */}
					<section>
						<h3 className="mb-2 font-medium text-solarized-base00">Benutzer</h3>
						<div className="rounded-lg border border-solarized-base2 p-3">
							<p className="font-medium text-solarized-base00">
								{event.user.name || "Kein Name"}
							</p>
							<p className="text-sm text-solarized-base01">{event.user.email}</p>
						</div>
					</section>

					{/* Action & Model Section */}
					<section>
						<h3 className="mb-2 font-medium text-solarized-base00">
							Aktion & Modell
						</h3>
						<div className="space-y-2 rounded-lg border border-solarized-base2 p-3">
							<div className="flex justify-between">
								<span className="text-solarized-base01">Aktion</span>
								<span className="font-mono text-sm text-solarized-base00">
									{event.name}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-solarized-base01">Modell</span>
								<span className="font-mono text-sm text-solarized-base00">
									{event.model || "-"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-solarized-base01">Kosten</span>
								<span className="font-mono text-sm text-solarized-base00">
									{cost !== null ? `$${cost.toFixed(6)}` : "-"}
								</span>
							</div>
						</div>
					</section>

					{/* Token Usage Section */}
					<section>
						<h3 className="mb-2 font-medium text-solarized-base00">
							Token-Nutzung
						</h3>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							<StatBox label="Input" value={event.inputTokens} />
							<StatBox label="Output" value={event.outputTokens} />
							<StatBox label="Gesamt" value={event.totalTokens} />
							<StatBox label="Reasoning" value={event.reasoningTokens} />
							<StatBox label="Cached" value={event.cachedTokens} />
						</div>
					</section>

					{/* Input Data Section (JSON) */}
					{event.inputData && (
						<section>
							<h3 className="mb-2 font-medium text-solarized-base00">
								Eingabedaten
							</h3>
							<div className="max-h-48 overflow-auto rounded-lg border border-solarized-base2 bg-solarized-base3">
								<pre className="whitespace-pre-wrap p-3 font-mono text-xs">
									{JSON.stringify(event.inputData, null, 2)}
								</pre>
							</div>
						</section>
					)}

					{/* Metadata Section (JSON) */}
					{event.metadata && (
						<section>
							<h3 className="mb-2 font-medium text-solarized-base00">
								Metadaten
							</h3>
							<div className="max-h-32 overflow-auto rounded-lg border border-solarized-base2 bg-solarized-base3">
								<pre className="whitespace-pre-wrap p-3 font-mono text-xs">
									{JSON.stringify(event.metadata, null, 2)}
								</pre>
							</div>
						</section>
					)}

					{/* Result Section (Text) */}
					{event.result && (
						<section>
							<h3 className="mb-2 font-medium text-solarized-base00">
								Ergebnis
							</h3>
							<div className="max-h-48 overflow-auto rounded-lg border border-solarized-base2 bg-solarized-base3">
								<div className="whitespace-pre-wrap p-3 text-sm">
									{event.result}
								</div>
							</div>
						</section>
					)}

					{/* Reasoning Section (Text) */}
					{event.reasoning && (
						<section>
							<h3 className="mb-2 font-medium text-solarized-base00">
								Reasoning
							</h3>
							<div className="max-h-48 overflow-auto rounded-lg border border-solarized-base2 bg-solarized-base3">
								<div className="whitespace-pre-wrap p-3 text-sm italic text-solarized-base01">
									{event.reasoning}
								</div>
							</div>
						</section>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
