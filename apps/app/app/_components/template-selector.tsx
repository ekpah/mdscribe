"use client";

import { SearchableSelect } from "@repo/design-system/components/ui/searchable-select";
import { useMemo } from "react";

import { USER_MESSAGES } from "@/lib/user-messages";

const compareTemplateText = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
}).compare;

interface TemplateSelectorTemplate {
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
			...templates
				.toSorted((a, b) => compareTemplateText(a.title, b.title))
				.map((template) => ({ label: template.title, value: template.id })),
		],
		[noneLabel, noneValue, templates],
	);

	return (
		<SearchableSelect
			className={className}
			disabled={disabled}
			emptyMessage={
				templates.length === 0 ? emptyMessage : USER_MESSAGES.searchableSelect.templateEmpty
			}
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
