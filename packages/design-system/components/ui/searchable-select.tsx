"use client"

import { Loader2 } from "lucide-react"
import * as React from "react"

import { cn } from "../../lib/utils"
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxTrigger,
} from "./combobox"

const compareSelectorText = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
}).compare

export interface SearchableSelectOption {
	key?: string
	value: string
	label: string
	group?: string
	keywords?: string[]
	disabled?: boolean
}

interface SearchableSelectProps<TOption extends SearchableSelectOption> {
	id?: string
	options: readonly TOption[]
	value: string | null | undefined
	onValueChange: (value: string) => void
	placeholder?: string
	emptyMessage?: string
	loadingMessage?: string
	disabled?: boolean
	isLoading?: boolean
	searchPlaceholder?: string
	className?: string
	popoverClassName?: string
	listClassName?: string
	formatGroupLabel?: (group: string) => string
	renderSelected?: (selected: TOption | null) => React.ReactNode
	renderOption?: (option: TOption, isSelected: boolean) => React.ReactNode
}

interface NormalizedOption<TOption extends SearchableSelectOption> {
	key: string
	option: TOption
}

export function SearchableSelect<TOption extends SearchableSelectOption>({
	id,
	options,
	value,
	onValueChange,
	placeholder = "Auswählen...",
	emptyMessage = "Keine Optionen gefunden.",
	loadingMessage = "Optionen werden geladen...",
	disabled = false,
	isLoading = false,
	searchPlaceholder = "Option suchen...",
	className,
	popoverClassName,
	listClassName,
	formatGroupLabel,
	renderSelected,
	renderOption,
}: SearchableSelectProps<TOption>) {
	const [isOpen, setIsOpen] = React.useState(false)
	const [searchQuery, setSearchQuery] = React.useState("")

	const normalizedOptions = React.useMemo<NormalizedOption<TOption>[]>(() => {
		return options.map((option) => ({
			key: option.key ?? option.value,
			option,
		}))
	}, [options])

	const deferredSearchQuery = React.useDeferredValue(searchQuery)
	const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase()

	const filteredOptions = React.useMemo(() => {
		if (!normalizedSearchQuery) {
			return normalizedOptions
		}

		return normalizedOptions.filter(({ option }) => {
			const haystacks = [
				option.label,
				option.group,
				...(option.keywords ?? []),
			]

			return haystacks.some((entry) =>
				entry?.toLowerCase().includes(normalizedSearchQuery)
			)
		})
	}, [normalizedOptions, normalizedSearchQuery])

	const optionByKey = React.useMemo(() => {
		return new Map(normalizedOptions.map((entry) => [entry.key, entry.option]))
	}, [normalizedOptions])

	const firstKeyByValue = React.useMemo(() => {
		const map = new Map<string, string>()
		for (const entry of normalizedOptions) {
			if (!map.has(entry.option.value)) {
				map.set(entry.option.value, entry.key)
			}
		}
		return map
	}, [normalizedOptions])

	const selectedKey = value ? firstKeyByValue.get(value) : undefined
	const selectedOption = selectedKey ? optionByKey.get(selectedKey) ?? null : null

	const groupedOptions = React.useMemo<[string, NormalizedOption<TOption>[]][]>(
		() => {
			const groups = new Map<string, NormalizedOption<TOption>[]>()
			for (const entry of filteredOptions) {
				const group = entry.option.group ?? ""
				const existing = groups.get(group)
				if (existing) {
					existing.push(entry)
				} else {
					groups.set(group, [entry])
				}
			}

			return Array.from(groups.entries())
				.map(
					([group, entries]): [string, NormalizedOption<TOption>[]] => [
					group,
					[...entries].sort((a, b) => {
						const labelCompare = compareSelectorText(
							a.option.label,
							b.option.label
						)
						if (labelCompare !== 0) {
							return labelCompare
						}

						return compareSelectorText(a.key, b.key)
					}),
				])
				.sort(([groupA], [groupB]) => {
					if (!groupA && groupB) {
						return -1
					}
					if (groupA && !groupB) {
						return 1
					}

					const labelA = formatGroupLabel ? formatGroupLabel(groupA) : groupA
					const labelB = formatGroupLabel ? formatGroupLabel(groupB) : groupB
					return compareSelectorText(labelA, labelB)
				})
		},
		[filteredOptions, formatGroupLabel]
	)

	const handleSelect = React.useCallback(
		(nextEntry: NormalizedOption<TOption> | null) => {
			if (!nextEntry) return
			onValueChange(nextEntry.option.value)
		},
		[onValueChange]
	)

	const handleOpenChange = React.useCallback((open: boolean) => {
		setIsOpen(open)
		if (!open) {
			setSearchQuery("")
		}
	}, [])

	return (
		<Combobox<NormalizedOption<TOption>>
			autoHighlight
			disabled={disabled || isLoading}
			filter={null}
			filteredItems={filteredOptions}
			inputValue={searchQuery}
			isItemEqualToValue={(item, selected) => item.key === selected.key}
			itemToStringLabel={(item) => item.option.label}
			itemToStringValue={(item) => item.option.value}
			items={normalizedOptions}
			onInputValueChange={setSearchQuery}
			onOpenChange={handleOpenChange}
			onValueChange={handleSelect}
			open={isOpen}
			value={selectedKey && selectedOption ? { key: selectedKey, option: selectedOption } : null}
		>
			<ComboboxTrigger
				id={id}
				className={cn(
					"h-auto min-h-11 text-base sm:min-h-9 sm:text-sm",
					className,
					isLoading && "cursor-wait"
				)}
			>
				<div className="min-w-0 flex-1 text-left">
					{isLoading ? (
						<div className="flex items-center gap-2">
							<Loader2 aria-hidden="true" className="size-4 animate-spin" />
							<span>{loadingMessage}</span>
						</div>
					) : selectedOption ? (
						renderSelected ? renderSelected(selectedOption) : (
							<span className="block min-w-0 truncate">{selectedOption.label}</span>
						)
					) : (
						<span className="block text-muted-foreground">{placeholder}</span>
					)}
				</div>
			</ComboboxTrigger>
			<ComboboxContent
				aria-label={placeholder}
				className={cn("w-[max(var(--anchor-width),18rem)]", popoverClassName)}
			>
				<div className="border-input border-b p-1">
					<ComboboxInput
						aria-label={searchPlaceholder}
						autoComplete="off"
						className="h-11 border-0 bg-transparent shadow-none sm:h-9 dark:bg-transparent"
						placeholder={searchPlaceholder}
						showTrigger={false}
					/>
				</div>
						<ComboboxEmpty className="text-base sm:text-sm">
							{emptyMessage}
						</ComboboxEmpty>
						<ComboboxList
							className={cn(
								"max-h-[min(22rem,calc(var(--available-height)-3rem))] overflow-x-hidden overflow-y-auto overscroll-contain p-1",
								listClassName
							)}
						>
							{groupedOptions.map(([group, entries]) => (
								<ComboboxGroup key={group || "__ungrouped__"}>
									{group ? (
										<ComboboxLabel>
											{formatGroupLabel ? formatGroupLabel(group) : group}
										</ComboboxLabel>
									) : null}
									{entries.map((entry) => {
										const isSelected = entry.key === selectedKey
										return (
											<ComboboxItem
												className="min-h-11 gap-3 px-3 py-2 text-base sm:min-h-9 sm:text-sm"
												disabled={entry.option.disabled}
												key={entry.key}
												value={entry}
											>
												<div className="min-w-0 flex-1">
													{renderOption ? renderOption(entry.option, isSelected) : (
														<span className="block min-w-0 truncate">{entry.option.label}</span>
													)}
												</div>
											</ComboboxItem>
										)
									})}
								</ComboboxGroup>
							))}
						</ComboboxList>
			</ComboboxContent>
		</Combobox>
	)
}

export type ModelSelectorOption = SearchableSelectOption
export const ModelSelector = <TOption extends ModelSelectorOption>(
	props: SearchableSelectProps<TOption>
) => (
	<SearchableSelect
		emptyMessage="Keine Modelle gefunden."
		loadingMessage="Lade Modelle..."
		placeholder="Modell auswählen..."
		searchPlaceholder="Modell suchen..."
		{...props}
	/>
)
