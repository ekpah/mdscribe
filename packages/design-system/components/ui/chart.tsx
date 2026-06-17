"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@repo/design-system/lib/utils"

const THEMES = {
  dark: ".dark",
  light: "",
} as const

// recharts' ResponsiveContainer defaults initialDimension to {-1, -1}, which
// makes the first render (before the ResizeObserver measures the container)
// log "The width(-1) and height(-1) of chart should be greater than 0". recharts
// only warns when neither dimension is > 0, so a minimal positive seed silences
// it; the observer overwrites these with the real measured size on the next
// frame, and 1x1 is too small to cause a visible wrong-size flash.
const CHART_INITIAL_DIMENSION = { height: 1, width: 1 } as const

export type ChartConfig = {
  [key: string]: {
    color?: string
    icon?: React.ComponentType
    label?: React.ReactNode
    theme?: Record<keyof typeof THEMES, string>
  }
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer initialDimension={CHART_INITIAL_DIMENSION}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, configItem]) => configItem.theme || configItem.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .filter(Boolean)
  .join("\n")}
}`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type ChartTooltipPayloadItem = {
  color?: string
  dataKey?: string | number
  fill?: string
  name?: string | number
  payload?: Record<string, unknown>
  stroke?: string
  value?: number | string | Array<number | string>
}

interface ChartTooltipContentProps extends React.ComponentProps<"div"> {
  active?: boolean
  hideIndicator?: boolean
  hideLabel?: boolean
  indicator?: "dot" | "line"
  label?: string | number
  labelFormatter?: (label: string | number | undefined) => React.ReactNode
  nameKey?: string
  payload?: ChartTooltipPayloadItem[]
  valueFormatter?: (
    value: ChartTooltipPayloadItem["value"],
    name: string
  ) => React.ReactNode
}

function ChartTooltipContent({
  active,
  className,
  hideIndicator = false,
  hideLabel = false,
  indicator = "dot",
  label,
  labelFormatter,
  nameKey,
  payload,
  valueFormatter,
}: ChartTooltipContentProps) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  const tooltipLabel = hideLabel
    ? null
    : labelFormatter
      ? labelFormatter(label)
      : label

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl",
        className
      )}
    >
      {tooltipLabel ? (
        <div className="font-medium text-foreground">{tooltipLabel}</div>
      ) : null}
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = `${nameKey ? item.payload?.[nameKey] : item.name || item.dataKey || "value"}`
          const itemConfig = config[key]
          const color = item.color || item.fill || item.stroke || itemConfig?.color
          const name = itemConfig?.label ?? item.name ?? item.dataKey

          return (
            <div
              key={`${key}-${item.dataKey}`}
              className="flex min-w-0 items-center gap-2"
            >
              {hideIndicator ? null : (
                <div
                  className={cn(
                    "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                    indicator === "dot" && "h-2.5 w-2.5",
                    indicator === "line" && "h-0.5 w-3"
                  )}
                  style={
                    {
                      "--color-bg": color,
                      "--color-border": color,
                    } as React.CSSProperties
                  }
                />
              )}
              <div className="flex flex-1 justify-between gap-4 leading-none">
                <span className="text-muted-foreground">{name}</span>
                <span className="font-mono font-medium text-foreground">
                  {valueFormatter
                    ? valueFormatter(item.value, key)
                    : Array.isArray(item.value)
                      ? item.value.join(" - ")
                      : item.value}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
