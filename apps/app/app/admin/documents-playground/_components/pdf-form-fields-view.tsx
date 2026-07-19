import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import { Badge } from "@repo/design-system/components/ui/badge";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Braces, ListTree, Loader2 } from "lucide-react";

import type { PdfFormField } from "@/app/documents/_lib";
import { USER_MESSAGES } from "@/lib/user-messages";

const messages = USER_MESSAGES.documentPlaygroundFormFields;

const renderPropertyValue = (value: unknown) => {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return <code className="text-solarized-base01">[]</code>;
		}

		return (
			<div className="flex flex-wrap gap-1.5">
				{value.map((item) => (
					<Badge
						className="max-w-full border-solarized-base2 bg-solarized-base2/40 font-mono font-normal text-solarized-base00"
						key={String(item)}
						variant="outline"
					>
						<span className="break-all">{String(item)}</span>
					</Badge>
				))}
			</div>
		);
	}

	if (typeof value === "boolean") {
		return (
			<Badge
				className="border-solarized-base2 bg-solarized-base2/40 font-mono font-normal text-solarized-base00"
				variant="outline"
			>
				{String(value)}
			</Badge>
		);
	}

	if (value === "") {
		return <code className="text-solarized-base01">&quot;&quot;</code>;
	}

	return <span className="break-all font-mono text-solarized-base00">{String(value)}</span>;
};

const PdfFieldCard = ({ field, index }: { field: PdfFormField; index: number }) => (
	<AccordionItem
		className="overflow-hidden rounded-lg border border-solarized-base2 bg-solarized-base2/15 last:border-b"
		value={field.name}
	>
		<AccordionTrigger className="gap-2 rounded-none bg-solarized-base2/25 px-3 py-2.5 hover:no-underline">
			<div className="flex min-w-0 flex-1 flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<p className="font-normal text-solarized-base01 text-xs">#{index + 1}</p>
					<span className="block break-all font-medium font-mono text-sm text-solarized-base00">
						{field.name}
					</span>
				</div>
				<div className="flex shrink-0 flex-wrap gap-1.5">
					<Badge className="font-mono font-normal" variant="secondary">
						{field.type}
					</Badge>
					<Badge className="font-mono font-normal" variant="outline">
						{field.inputKind}
					</Badge>
				</div>
			</div>
		</AccordionTrigger>
		<AccordionContent className="p-0">
			<dl className="divide-y divide-solarized-base2/70 border-solarized-base2 border-t">
				{Object.entries(field).map(([key, value]) => (
					<div className="grid gap-1 px-3 py-2 sm:grid-cols-[140px_minmax(0,1fr)]" key={key}>
						<dt className="min-w-0 text-solarized-base01 text-xs">
							<span className="block">
								{messages.propertyLabels[key as keyof typeof messages.propertyLabels] ?? key}
							</span>
							<code className="text-[10px] opacity-70">{key}</code>
						</dt>
						<dd className="min-w-0 text-sm">{renderPropertyValue(value)}</dd>
					</div>
				))}
			</dl>
		</AccordionContent>
	</AccordionItem>
);

export const PdfFormFieldsView = ({
	error,
	fields,
	isLoading,
	isPdfSelected,
}: {
	error: string | null;
	fields: PdfFormField[] | null;
	isLoading: boolean;
	isPdfSelected: boolean;
}) => {
	if (isLoading) {
		return (
			<div className="flex min-h-[340px] items-center justify-center gap-2 text-solarized-base01 text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				{messages.loading}
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-[340px] rounded-lg border border-solarized-red/30 bg-solarized-red/5 p-4 text-solarized-red text-sm">
				{error}
			</div>
		);
	}

	if (!isPdfSelected) {
		return (
			<div className="flex min-h-[340px] items-center justify-center rounded-lg border border-dashed border-solarized-base2 p-6 text-center text-solarized-base01 text-sm">
				{messages.unavailable}
			</div>
		);
	}

	if (!fields || fields.length === 0) {
		return (
			<div className="flex min-h-[340px] items-center justify-center rounded-lg border border-dashed border-solarized-base2 p-6 text-center text-solarized-base01 text-sm">
				{messages.empty}
			</div>
		);
	}

	const rawJson = JSON.stringify({ fields }, null, 2);

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-solarized-base2 bg-solarized-base2/20 px-3 py-2 text-xs">
				<span className="flex items-center gap-1.5 font-medium text-solarized-base00">
					<ListTree className="h-3.5 w-3.5 text-solarized-magenta" />
					{fields.length.toLocaleString("de-DE")} {messages.fieldCount}
				</span>
				<span className="text-solarized-base01">pdf-lib</span>
			</div>
			<ScrollArea className="h-[340px] pr-3">
				<Accordion className="space-y-2" multiple>
					{fields.map((field, index) => (
						<PdfFieldCard field={field} index={index} key={field.name} />
					))}
				</Accordion>
			</ScrollArea>
			<details className="group overflow-hidden rounded-lg border border-solarized-base2 bg-solarized-base2/15">
				<summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-medium text-solarized-base00 text-sm marker:hidden">
					<Braces className="h-4 w-4 text-solarized-magenta" />
					{messages.rawJson}
				</summary>
				<pre className="max-h-[340px] overflow-auto border-solarized-base2 border-t bg-solarized-base2/20 p-3 text-xs">
					<code>{rawJson}</code>
				</pre>
			</details>
		</div>
	);
};
