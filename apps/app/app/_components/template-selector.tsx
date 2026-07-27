"use client";

import { SearchableSelect } from "@repo/design-system/components/ui/searchable-select";
import { useMemo } from "react";

import { USER_MESSAGES } from "@/lib/user-messages";

const UNCATEGORIZED_LABEL = "Ohne Kategorie";
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
	const options = useMemo(
		() => [
			{ label: noneLabel, value: noneValue },
			...groupTemplatesByCategory(templates).flatMap((group) =>
				group.entries.map((template) => ({
					group: group.category,
					label: template.title,
					value: template.id,
				})),
			),
		],
		[noneLabel, noneValue, templates],
	);

	return (
		<SearchableSelect
			className={className}
			disabled={disabled}
			emptyMessage={templates.length === 0 ? emptyMessage : USER_MESSAGES.searchableSelect.templateEmpty}
			id={id}
			isLoading={isLoading}
			loadingMessage={loadingMessage}
			onValueChange={onValueChange}
			options={options}
			placeholder={placeholder}
			searchPlaceholder={USER_MESSAGES.searchableSelect.templateSearch}
			value={value}
		/>
	);
};
