"use client";

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Fragment } from "react";

const UNCATEGORIZED_LABEL = "Ohne Kategorie";
const LOADING_VALUE = "__template_selector_loading__";
const EMPTY_VALUE = "__template_selector_empty__";

const compareTemplateText = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
}).compare;

interface TemplateSelectorTemplate {
	category?: string | null;
	id: string;
	title: string;
}

interface TemplateSelectorProps<TTemplate extends TemplateSelectorTemplate> {
	className?: string;
	disabled?: boolean;
	emptyMessage?: string;
	id?: string;
	isLoading?: boolean;
	loadingMessage?: string;
	noneLabel?: string;
	noneValue: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	templates: TTemplate[];
	value: string;
}

const getCategoryLabel = (template: TemplateSelectorTemplate): string =>
	template.category?.trim() || UNCATEGORIZED_LABEL;

const groupTemplatesByCategory = <TTemplate extends TemplateSelectorTemplate>(
	templates: TTemplate[],
) => {
	const groups = new Map<string, TTemplate[]>();

	for (const template of templates) {
		const category = getCategoryLabel(template);
		const existing = groups.get(category);
		if (existing) {
			existing.push(template);
		} else {
			groups.set(category, [template]);
		}
	}

	return [...groups.entries()]
		.map(([category, entries]) => ({
			category,
			entries: entries.toSorted((a, b) => compareTemplateText(a.title, b.title)),
		}))
		.toSorted((a, b) => compareTemplateText(a.category, b.category));
};

export const TemplateSelector = <TTemplate extends TemplateSelectorTemplate>({
	className,
	disabled = false,
	emptyMessage = "Keine Templates gefunden.",
	id,
	isLoading = false,
	loadingMessage = "Lade Templates...",
	noneLabel = "Keins",
	noneValue,
	onValueChange,
	placeholder = "Template auswählen...",
	templates,
	value,
}: TemplateSelectorProps<TTemplate>) => {
	const groups = groupTemplatesByCategory(templates);

	return (
		<Select disabled={disabled} onValueChange={onValueChange} value={value}>
			<SelectTrigger className={className} id={id}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={noneValue}>{noneLabel}</SelectItem>

				{isLoading ? (
					<>
						<SelectSeparator />
						<SelectItem disabled value={LOADING_VALUE}>
							{loadingMessage}
						</SelectItem>
					</>
				) : null}

				{!isLoading && groups.length === 0 ? (
					<>
						<SelectSeparator />
						<SelectItem disabled value={EMPTY_VALUE}>
							{emptyMessage}
						</SelectItem>
					</>
				) : null}

				{isLoading
					? null
					: groups.map((group) => (
							<Fragment key={group.category}>
								<SelectSeparator />
								<SelectGroup>
									<SelectLabel>{group.category}</SelectLabel>
									{group.entries.map((template) => (
										<SelectItem key={template.id} value={template.id}>
											{template.title}
										</SelectItem>
									))}
								</SelectGroup>
							</Fragment>
						))}
			</SelectContent>
		</Select>
	);
};
