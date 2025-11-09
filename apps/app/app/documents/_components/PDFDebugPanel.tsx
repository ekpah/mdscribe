"use client";

import type { FieldMapping } from "../_lib/parsePDFFormFields";
import { Card } from "@repo/design-system/components/ui/card";

interface PDFDebugPanelProps {
	values: Record<string, unknown>;
	fieldMapping: FieldMapping[];
}

export default function PDFDebugPanel({
	values,
	fieldMapping,
}: PDFDebugPanelProps) {
	// Don't render if there are no values or no field mapping
	if (Object.keys(values).length === 0 || fieldMapping.length === 0) {
		return null;
	}

	return (
		<Card className="fixed bottom-4 right-4 z-50 h-96 w-96 overflow-hidden border shadow-lg flex flex-col">
			<div className="border-b bg-muted/50 px-2 py-1 flex-shrink-0">
				<h4 className="font-semibold text-xs">Formularwerte</h4>
			</div>
			<div className="overflow-y-auto flex-1 p-2">
				<div className="space-y-1">
					{Object.entries(values).map(([key, value]) => {
						const mapping = Object.values(fieldMapping).find(
							(fm) => fm.label === key,
						);
						const fieldName = mapping?.fieldName || "N/A";
						const displayValue =
							typeof value === "string"
								? value
								: value?.toString() || String(value);

						return (
							<div
								key={key}
								className="border-b border-border/50 pb-1 last:border-0 last:pb-0 text-[10px]"
							>
								{fieldName === key ? (
									<div className="flex items-start gap-1">
										<span className="text-muted-foreground font-medium flex-shrink-0">
											label/fieldname:
										</span>
										<span className="font-mono truncate">{fieldName}</span>
									</div>
								) : (
									<>
										<div className="flex items-start gap-1">
											<span className="text-muted-foreground font-medium flex-shrink-0">
												label:
											</span>
											<span className="font-mono truncate">{key}</span>
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
