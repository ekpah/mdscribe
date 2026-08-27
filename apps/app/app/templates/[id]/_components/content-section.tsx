"use client";

import { cn } from "@repo/design-system/lib/utils";
import { parseMarkdocToInputs } from "markdoc-md/parse";
import { DynamicMarkdocRenderer } from "markdoc-md/react";
import { FileText, Info, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { InputPreviewSection } from "@/app/_components/input-preview-section";
import { USER_MESSAGES } from "@/lib/user-messages";

type TemplateContentView = "template" | "examples" | "information";

const tabRailClassName = "absolute right-0 top-4 z-20 flex flex-col items-end gap-1";

const getFolderTabClassName = (isActive: boolean) =>
	cn(
		"relative flex h-36 w-10 flex-col items-center justify-center gap-2 rounded-l-md border border-r-0 bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		isActive && "z-10 bg-card text-foreground shadow-md",
	);

const ContentViewTabs = ({
	activeView,
	examplesCount,
	examplesHref,
	informationHref,
	templateHref,
}: {
	activeView: TemplateContentView;
	examplesCount: number;
	examplesHref: string;
	informationHref: string;
	templateHref: string;
}) => (
	<nav aria-label="Template-Inhalt" className={tabRailClassName}>
		<Link
			aria-current={activeView === "template" ? "page" : undefined}
			className={getFolderTabClassName(activeView === "template")}
			href={templateHref}
		>
			<FileText aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
			<span className="rotate-180 whitespace-nowrap font-medium text-[11px] leading-none [writing-mode:vertical-rl]">
				Textbaustein
			</span>
		</Link>
		<Link
			aria-current={activeView === "examples" ? "page" : undefined}
			aria-label={`Beispiele anzeigen (${examplesCount})`}
			className={getFolderTabClassName(activeView === "examples")}
			href={examplesHref}
		>
			<ListChecks aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
			<span className="rotate-180 whitespace-nowrap font-medium text-[11px] leading-none [writing-mode:vertical-rl]">
				Beispiele
			</span>
			<span className="absolute bottom-1.5 rounded-full bg-muted px-1.5 py-0.5 font-medium text-[10px] leading-none text-muted-foreground">
				{examplesCount}
			</span>
		</Link>
		<Link
			aria-current={activeView === "information" ? "page" : undefined}
			className={getFolderTabClassName(activeView === "information")}
			href={informationHref}
		>
			<Info aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
			<span className="rotate-180 whitespace-nowrap font-medium text-[11px] leading-none [writing-mode:vertical-rl]">
				{USER_MESSAGES.templateInformationLabel}
			</span>
		</Link>
	</nav>
);

const ExamplesPreview = ({ examples }: { examples: string[] }) => {
	if (examples.length === 0) {
		return (
			<div className="flex min-h-full items-center justify-center">
				<div className="max-w-sm rounded-md border border-dashed bg-muted/30 p-6 text-center">
					<p className="font-medium text-sm">Noch keine Beispiele hinterlegt.</p>
					<p className="mt-2 text-muted-foreground text-sm">
						Dieser Textbaustein kann trotzdem direkt verwendet werden.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{examples.map((example, index) => (
				<div className="space-y-2" key={`template-example-preview-${example}`}>
					<p className="font-medium text-sm">Beispiel {index + 1}</p>
					<pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
						{example}
					</pre>
				</div>
			))}
		</div>
	);
};

const InformationPreview = ({ information }: { information: string }) => {
	if (!information) {
		return (
			<div className="flex min-h-full items-center justify-center">
				<div className="max-w-sm rounded-md border border-dashed bg-muted/30 p-6 text-center">
					<p className="font-medium text-sm">{USER_MESSAGES.templateInformationEmpty}</p>
					<p className="mt-2 text-muted-foreground text-sm">
						{USER_MESSAGES.templateInformationEmptyDescription}
					</p>
				</div>
			</div>
		);
	}

	return (
		<pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
			{information}
		</pre>
	);
};

export default function ContentSection({
	contentView,
	note,
	examples,
	information,
}: {
	contentView: TemplateContentView;
	note: string;
	examples: string[];
	information: string;
}) {
	const inputTags = useMemo(() => parseMarkdocToInputs(note), [note]);
	const [activeInputName, setActiveInputName] = useState<string | null>(null);
	const [activeInputFocusKey, setActiveInputFocusKey] = useState(0);
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const buildContentViewHref = (view: TemplateContentView) => {
		const nextSearchParams = new URLSearchParams(searchParams.toString());

		if (view === "examples" || view === "information") {
			nextSearchParams.set("view", view);
		} else {
			nextSearchParams.delete("view");
		}

		const nextQuery = nextSearchParams.toString();
		return nextQuery ? `${pathname}?${nextQuery}` : pathname;
	};
	const contentTabs = (
		<ContentViewTabs
			activeView={contentView}
			examplesCount={examples.length}
			examplesHref={buildContentViewHref("examples")}
			informationHref={buildContentViewHref("information")}
			templateHref={buildContentViewHref("template")}
		/>
	);
	const handleInputSelect = useCallback((inputName: string) => {
		setActiveInputName(inputName);
	}, []);
	const handleMarkdocTagSelect = useCallback((tagName: string) => {
		setActiveInputName(tagName);
		setActiveInputFocusKey((currentKey) => currentKey + 1);
	}, []);

	return (
		<InputPreviewSection
			activeInputFocusKey={activeInputFocusKey}
			activeInputName={activeInputName}
			contentType="template"
			edgeTabs={contentTabs}
			inputTags={inputTags}
			onInputSelect={handleInputSelect}
			preview={(values) => {
				if (contentView === "examples") {
					return <ExamplesPreview examples={examples} />;
				}
				if (contentView === "information") {
					return <InformationPreview information={information} />;
				}
				return (
					<DynamicMarkdocRenderer
						activeTagName={activeInputName}
						className="prose prose-slate grow"
						markdocContent={note as string}
						onTagSelect={handleMarkdocTagSelect}
						variables={values}
					/>
				);
			}}
			resetKey={note}
			templateInformation={information}
		/>
	);
}
