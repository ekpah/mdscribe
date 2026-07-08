"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@repo/design-system/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

type SelectContextValue = {
  value: unknown
  labels: Map<unknown, string>
  registerLabel: (value: unknown, label: string) => () => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

// Base UI types `onValueChange` as `(value: Value | null)` because items may
// carry null values. This repo only uses non-null item values, so narrow the
// callback to the pre-migration `(value: Value)` signature and guard nulls.
function Select<Value>({
  defaultValue,
  onValueChange,
  value,
  ...props
}: Omit<SelectPrimitive.Root.Props<Value>, "onValueChange"> & {
  onValueChange?: (
    value: Value,
    eventDetails: Parameters<
      NonNullable<SelectPrimitive.Root.Props<Value>["onValueChange"]>
    >[1]
  ) => void
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    Value | null | undefined
  >(defaultValue)
  const [labels, setLabels] = React.useState(() => new Map<unknown, string>())
  const currentValue = value !== undefined ? value : uncontrolledValue

  const registerLabel = React.useCallback((itemValue: unknown, label: string) => {
    setLabels((currentLabels) => {
      const nextLabels = new Map(currentLabels)
      nextLabels.set(itemValue, label)
      return nextLabels
    })

    return () => {
      setLabels((currentLabels) => {
        if (currentLabels.get(itemValue) !== label) {
          return currentLabels
        }

        const nextLabels = new Map(currentLabels)
        nextLabels.delete(itemValue)
        return nextLabels
      })
    }
  }, [])

  const contextValue = React.useMemo<SelectContextValue>(
    () => ({
      labels,
      registerLabel,
      value: currentValue,
    }),
    [currentValue, labels, registerLabel]
  )

  const handleValueChange = React.useMemo(() => {
    return ((value, eventDetails) => {
      if (value !== null) {
        setUncontrolledValue(value as Value)
        onValueChange?.(value as Value, eventDetails)
      }
    }) as NonNullable<SelectPrimitive.Root.Props<Value>["onValueChange"]>
  }, [onValueChange])

  return (
    <SelectContext.Provider value={contextValue}>
      <SelectPrimitive.Root
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        value={value}
        {...props}
      />
    </SelectContext.Provider>
  )
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1.5 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  className,
  children,
  ...props
}: SelectPrimitive.Value.Props) {
  const selectContext = React.useContext(SelectContext)

  if (typeof children === "function") {
    return (
      <SelectPrimitive.Value
        data-slot="select-value"
        className={cn("flex flex-1 text-left", className)}
        {...props}
      >
        {children}
      </SelectPrimitive.Value>
    )
  }

  if (children !== undefined && typeof children !== "function") {
    return (
      <span
        data-slot="select-value"
        className={cn("flex flex-1 text-left", className)}
      >
        {children}
      </span>
    )
  }

  const label = selectContext?.labels.get(selectContext.value)
  if (label) {
    return (
      <span
        data-slot="select-value"
        className={cn("flex flex-1 text-left", className)}
      >
        {label}
      </span>
    )
  }

  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

function getSelectItemLabel(children: React.ReactNode): string | undefined {
  if (typeof children === "string" || typeof children === "number") {
    return String(children)
  }

  if (Array.isArray(children)) {
    const label = children
      .map((child) => getSelectItemLabel(child))
      .filter((part): part is string => Boolean(part))
      .join("")
      .trim()

    return label || undefined
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return getSelectItemLabel(children.props.children)
  }

  return undefined
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input text-foreground data-placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon
            size={16}
            className="pointer-events-none shrink-0 text-muted-foreground/80 in-aria-invalid:text-destructive/80"
          />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "border-input bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-[min(24rem,var(--available-height))] w-full min-w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-lg duration-100 data-[align-trigger=true]:animate-none [&_[role=group]]:py-1",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "text-muted-foreground py-1.5 ps-8 pe-2 text-xs font-medium",
        className
      )}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  label,
  value,
  ...props
}: SelectPrimitive.Item.Props) {
  const registerLabel = React.useContext(SelectContext)?.registerLabel
  const itemLabel = label ?? getSelectItemLabel(children)

  React.useEffect(() => {
    if (itemLabel === undefined) {
      return
    }

    return registerLabel?.(value, itemLabel)
  }, [itemLabel, registerLabel, value])

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      value={value}
      label={itemLabel}
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-default items-center rounded py-1.5 ps-8 pe-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute start-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon size={16} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
