"use client";

import { Card } from "@repo/design-system/components/ui/card";

interface PDFDebugPanelProps {
	values: Record<string, unknown>;
	fieldMapping: Record<string, string>;
}

export default function PDFDebugPanel({
	values,
	fieldMapping,
}: PDFDebugPanelProps) {
	// Don't render if there are no values
	if (Object.keys(values).length === 0) {
		return null;
	}

	return (
		<Card className="fixed bottom-4 right-4 z-50 h-96 w-96 overflow-hidden border shadow-lg flex flex-col">
			<div className="border-b bg-muted/50 px-2 py-1 flex-shrink-0">
				<h4 className="font-semibold text-xs">Form Values</h4>
			</div>
			<div className="overflow-y-auto flex-1 p-2">
				<div className="space-y-1">
					{Object.entries(values).map(([label, value]) => {
						const fieldName = fieldMapping[label] || "N/A";
						const displayValue =
							typeof value === "string"
								? value
								: value?.toString() || String(value);

						return (
							<div
								key={label}
								className="border-b border-border/50 pb-1 last:border-0 last:pb-0 text-[10px]"
							>
								{label === fieldName ? (
									<div className="flex items-start gap-1">
										<span className="text-muted-foreground font-medium flex-shrink-0">
											label/fieldname:
										</span>
										<span className="font-mono truncate">{label}</span>
									</div>
								) : (
									<>
										<div className="flex items-start gap-1">
											<span className="text-muted-foreground font-medium flex-shrink-0">
												label:
											</span>
											<span className="font-mono truncate">{label}</span>
										</div>
										<div className="flex items-start gap-1">
											<span className="text-muted-foreground font-medium flex-shrink-0">
												fieldname:
											</span>
											<span className="font-mono truncate">{fieldName}</span>
										</div>
									</>
								)}
								<div className="flex items-start gap-1">
									<span className="text-muted-foreground font-medium flex-shrink-0">
										value:
									</span>
									<span className="font-mono break-words">{displayValue}</span>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</Card>
	);
}
