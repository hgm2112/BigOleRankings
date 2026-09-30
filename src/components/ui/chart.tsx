"use client"

import * as React from "react"
import {
  Legend as RechartsLegend,
  ResponsiveContainer as RechartsResponsiveContainer,
  Tooltip as RechartsTooltip,
  type LegendPayload,
  type TooltipContentProps,
  type TooltipPayloadEntry,
} from "recharts"

import { cn } from "@/lib/utils"

type ChartConfigRecord = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
    icon?: React.ComponentType<{ className?: string }>
  }
>

export type ChartConfig = ChartConfigRecord & {
  // Allows the root config object to hold non-series keys (e.g. metadata).
  [key: string]: { label?: React.ReactNode; color?: string; icon?: React.ComponentType<{ className?: string }> } | undefined
}

interface ChartContextProps {
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

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, config]) => config.color || config.color)
  if (!colorConfig.length) return null
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
[data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.color ?? ""
    return `  --color-${key}: ${color};`
  })
  .join("\n")}
}
`,
      }}
    />
  )
}

export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig
  children: React.ReactNode
}

export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, className, children, ...props }, ref) => {
    const uniqueId = React.useId()
    const chartId = `chart-${uniqueId.replace(/:/g, "")}`

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          data-chart={chartId}
          ref={ref}
          className={cn(
            "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_horizontal[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot.recharts-tooltip-dot]:stroke-border [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-rect]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
            className,
          )}
          {...props}
        >
          <ChartStyle id={chartId} config={config} />
          <RechartsResponsiveContainer width="100%" height="100%">
            {children}
          </RechartsResponsiveContainer>
        </div>
      </ChartContext.Provider>
    )
  },
)
ChartContainer.displayName = "ChartContainer"

type ChartTooltipProps = Omit<React.ComponentProps<typeof RechartsTooltip>, "content"> & {
  content?: React.ComponentProps<typeof RechartsTooltip>["content"]
}

export function ChartTooltip(props: ChartTooltipProps) {
  return <RechartsTooltip {...props} />
}

export type ChartTooltipContentProps = Partial<TooltipContentProps> & {
  className?: string
  indicator?: "line" | "dot" | "dashed"
  hideLabel?: boolean
  hideIndicator?: boolean
  labelClassName?: string
  color?: string
  nameKey?: string
  labelKey?: string
}

export const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      labelClassName,
      color,
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) return null
      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || "value"}`
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      if (!itemConfig) return null
      return itemConfig.label || item.name
    }, [labelKey, payload, hideLabel, config])

    if (!active || !payload?.length) return null

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl",
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color || item.payload?.fill || item.color

            return (
              <div
                key={index}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center",
                )}
                style={hideIndicator ? { paddingLeft: 0 } : undefined}
              >
                {!hideIndicator && (
                  <div
                    className={cn("shrink-0 rounded-(--[radius])", {
                      "h-2.5 w-2.5": indicator === "dot",
                      "h-0 w-0.5 translate-y-[3px] rounded-none": indicator === "line",
                      "h-0 w-0.5 translate-y-[3px] rounded-none border-2 border-dashed border-current":
                        indicator === "dashed",
                      "my-0.5": nestLabel,
                    })}
                    style={{ backgroundColor: indicatorColor, color: indicatorColor }}
                  />
                )}
                <div className="flex flex-1 shrink-0 items-center justify-between gap-2">
                  <span className={cn("text-muted-foreground", labelClassName)}>
                    {itemConfig?.label || item.name}
                  </span>
                  {item.value != null && (
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {Number(item.value).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
ChartTooltipContent.displayName = "ChartTooltipContent"

type ChartLegendProps = Omit<React.ComponentProps<typeof RechartsLegend>, "content"> & {
  content?: React.ComponentProps<typeof RechartsLegend>["content"]
}

export function ChartLegend(props: ChartLegendProps) {
  return <RechartsLegend {...props} />
}

export type ChartLegendContentProps = React.ComponentPropsWithoutRef<"div"> & {
  payload?: readonly LegendPayload[]
  verticalAlign?: "top" | "bottom" | "middle"
  hideIcon?: boolean
}

export function ChartLegendContent({ className, payload, verticalAlign = "bottom", hideIcon = false }: ChartLegendContentProps) {
  const { config } = useChart()
  if (!payload?.length) return null

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {payload.map((item) => {
        const key = `${item.dataKey ?? item.value ?? ""}`
        const itemConfig = getPayloadConfigFromPayload(config, item, key)

        return (
          <div
            key={item.value ?? key}
            className={cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground")}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon className="h-3 w-3" />
            ) : (
              <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: itemConfig?.color ?? item.color }} />
            )}
            {itemConfig?.label ?? item.value}
          </div>
        )
      })}
    </div>
  )
}

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, fallbackKey: string) {
  if (typeof payload !== "object" || payload === null) return undefined

  const payloadPayload =
    "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
      ? payload.payload
      : {}

  let configLabelKey: string = fallbackKey
  if (fallbackKey in config && typeof config[fallbackKey] === "object" && config[fallbackKey] !== null) {
    configLabelKey = fallbackKey
  } else if (
    "dataKey" in payloadPayload &&
    typeof payloadPayload.dataKey === "string" &&
    payloadPayload.dataKey in config &&
    typeof config[payloadPayload.dataKey] === "object" &&
    config[payloadPayload.dataKey] !== null
  ) {
    configLabelKey = payloadPayload.dataKey
  } else if ("name" in payloadPayload && typeof payloadPayload.name === "string" && payloadPayload.name in config) {
    configLabelKey = payloadPayload.name
  }

  return configLabelKey in config ? config[configLabelKey] : undefined
}

export type { TooltipPayloadEntry }
