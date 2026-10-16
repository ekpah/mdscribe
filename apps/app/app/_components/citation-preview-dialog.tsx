"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { ExternalLink, FileText, Loader2, TriangleAlert } from "lucide-react";
import type { CitationResolution, CitationTextMatch } from "markdoc-md/citations";

export type CitationPreview =
	| CitationResolution
	| {
			kind: "loading";
			source: string;
	  };

const LocatedText = ({ match, text }: { match?: CitationTextMatch; text: string }) => (
	<div className="min-h-0 overflow-auto rounded-md border bg-muted/20 p-4">
		<pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
			{match ? (
				<>
					{text.slice(0, match.start)}
					<mark className="rounded-sm bg-solarized-blue/25 text-inherit">
						{text.slice(match.start, match.end)}
					</mark>
					{text.slice(match.end)}
				</>
			) : (
				text
			)}
		</pre>
	</div>
);

const LocatedDocument = ({
	preview,
}: {
	preview: Extract<CitationResolution, { kind: "document" }>;
}) => {
	const { location } = preview;
	if (!location) {
		return (
			<iframe
				className="h-full min-h-0 w-full rounded-md border bg-white"
				referrerPolicy="no-referrer"
				sandbox="allow-downloads"
				src={preview.url}
				title={`Quellenvorschau: ${preview.label}`}
			/>
		);
	}

	const imageSource = location.imageBase64.startsWith("data:")
		? location.imageBase64
		: `data:image/png;base64,${location.imageBase64}`;
	// Presentation-only padding keeps the border off the glyphs; OCR coordinates stay exact.
	const padding = Math.max(4, location.bounds.height * 0.25);
	const left = Math.max(0, location.bounds.x - padding);
	const top = Math.max(0, location.bounds.y - padding);
	const right = Math.min(location.pageWidth, location.bounds.x + location.bounds.width + padding);
	const bottom = Math.min(
		location.pageHeight,
		location.bounds.y + location.bounds.height + padding,
	);
	const highlightStyle = {
		height: `${((bottom - top) / location.pageHeight) * 100}%`,
		left: `${(left / location.pageWidth) * 100}%`,
		top: `${(top / location.pageHeight) * 100}%`,
		width: `${((right - left) / location.pageWidth) * 100}%`,
	};

	return (
		<div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
			<span className="text-muted-foreground text-xs">Seite {location.pageNumber}</span>
			<div
				className="flex min-h-0 overflow-auto rounded-md border bg-muted/20 p-2"
				style={{ containerType: "size" }}
			>
				<div
					className="relative m-auto shrink-0 shadow-sm"
					style={{
						width: `min(100cqw, calc(100cqh * ${location.pageWidth / location.pageHeight}))`,
					}}
				>
					{/* oxlint-disable-next-line next/no-img-element -- locally rendered page data URL, not an optimizable asset */}
					<img
						alt={`Seite ${location.pageNumber} aus ${preview.label}`}
						className="block h-auto w-full"
						height={location.pageHeight}
						src={imageSource}
						width={location.pageWidth}
					/>
					<span
						aria-label={`Zitierte Fundstelle: ${location.quote}`}
						className="pointer-events-none absolute rounded-sm border-2 border-solarized-orange bg-solarized-orange/20 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
						style={highlightStyle}
					/>
				</div>
			</div>
		</div>
	);
};

const getPreviewLabel = (preview: CitationPreview): string => {
	if (preview.kind === "loading" || preview.kind === "error") {
		return "Quelle";
	}
	return preview.label;
};

const getPreviewDescription = (preview: CitationPreview | null): string => {
	switch (preview?.kind) {
		case "loading": {
			return "Die Fundstelle wird in der Quelle gesucht.";
		}
		case "text": {
			return "Textquelle aus dem Eingabekontext von MDScribe.";
		}
		case "external": {
			return "Externe Quelle in einer eingeschränkten Vorschau.";
		}
		case "error": {
			return "Die Quelle konnte nicht geöffnet werden.";
		}
		default: {
			return "Temporäre lokale Vorschau der hochgeladenen Datei.";
		}
	}
};

const CitationPreviewContent = ({ preview }: { preview: CitationPreview | null }) => {
	switch (preview?.kind) {
		case "loading": {
			return (
				<div className="flex min-h-0 items-center justify-center gap-2 rounded-md border bg-muted/20 text-muted-foreground text-sm">
					<Loader2 className="h-4 w-4 animate-spin text-solarized-blue" />
					Fundstelle wird gesucht …
				</div>
			);
		}
		case "document": {
			return <LocatedDocument preview={preview} />;
		}
		case "external": {
			return (
				<iframe
					className="h-full min-h-0 w-full rounded-md border bg-white"
					referrerPolicy="no-referrer"
					sandbox="allow-downloads"
					src={preview.url}
					title={`Quellenvorschau: ${preview.label}`}
				/>
			);
		}
		case "text": {
			return <LocatedText match={preview.match} text={preview.text} />;
		}
		case "error": {
			return (
				<div className="flex min-h-0 flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
					<TriangleAlert className="h-6 w-6 text-destructive" />
					<p className="max-w-md text-sm">{preview.message}</p>
				</div>
			);
		}
		default: {
			return null;
		}
	}
};

const CitationPreviewPanel = ({ preview }: { preview: CitationPreview }) => (
	<div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3">
		<div className="min-w-0">
			<div className="flex min-w-0 items-center gap-2 font-semibold">
				<FileText className="h-4 w-4 shrink-0 text-solarized-cyan" />
				<span className="truncate">{getPreviewLabel(preview)}</span>
			</div>
			<p className="mt-1 text-muted-foreground text-sm">{getPreviewDescription(preview)}</p>
			{preview.kind === "external" || preview.kind === "document" ? (
				<a
					className="mt-1 inline-flex w-fit items-center gap-1 text-solarized-blue text-xs hover:underline"
					href={preview.url}
					rel="noopener noreferrer"
					target="_blank"
				>
					{preview.kind === "document" ? "Originaldatei öffnen" : "In neuem Tab öffnen"}
					<ExternalLink className="h-3 w-3" />
				</a>
			) : null}
			<code className="mt-1 block max-w-full truncate rounded bg-muted px-2 py-1 text-left font-normal text-[11px] text-muted-foreground">
				{preview.source}
			</code>
		</div>
		<CitationPreviewContent preview={preview} />
	</div>
);

const CitationPreviewsContent = ({ previews }: { previews: CitationPreview[] }) => {
	if (previews.length === 0) {
		return null;
	}
	if (previews.length === 1) {
		return <CitationPreviewPanel preview={previews[0]} />;
	}
	return (
		<Tabs className="min-h-0" defaultValue="source-0">
			<div className="max-w-full overflow-x-auto pb-1">
				<TabsList>
					{previews.map((preview, index) => (
						<TabsTrigger key={`${preview.source}-${index}`} value={`source-${index}`}>
							Quelle {index + 1}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
			{previews.map((preview, index) => (
				<TabsContent
					className="flex min-h-0"
					key={`${preview.source}-${index}`}
					value={`source-${index}`}
				>
					<CitationPreviewPanel preview={preview} />
				</TabsContent>
			))}
		</Tabs>
	);
};

export const CitationPreviewDialog = ({
	onOpenChange,
	previews,
}: {
	onOpenChange: (open: boolean) => void;
	previews: CitationPreview[] | null;
}) => (
	<Dialog onOpenChange={onOpenChange} open={previews !== null}>
		<DialogContent className="grid h-[min(92dvh,900px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3 sm:max-w-[min(92vw,1100px)] sm:p-4">
			<DialogHeader className="min-w-0 pr-8">
				<div className="w-fit rounded-full bg-solarized-cyan/15 px-2 py-0.5 font-semibold text-[10px] text-solarized-cyan uppercase tracking-wide">
					{previews?.length === 1 ? "Quelle" : `${previews?.length ?? 0} Quellen`}
				</div>
				<DialogTitle>Zitierte Quellen</DialogTitle>
				<DialogDescription>Prüfe die Fundstellen in den zitierten Quellen.</DialogDescription>
			</DialogHeader>
			<CitationPreviewsContent previews={previews ?? []} />
		</DialogContent>
	</Dialog>
);
