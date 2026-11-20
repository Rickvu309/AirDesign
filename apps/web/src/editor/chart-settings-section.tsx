import {
  chartBars,
  chartFormats,
  chartGap,
  chartLegend,
  chartLegends,
  chartLimits,
  type ChartFormat,
  type ChartValue,
  type Desc,
  type ElementId,
} from "@airdesign/document"
import { chartCopy } from "@/copy/chart-copy"
import { designCopy } from "@/copy/design-copy"
import { controlLabel } from "@/design/controls/control-label"
import { NumberField } from "@/design/controls/number"
import type { Palette } from "@/design/color-choices"
import type { DesignDeck } from "@/design/design-change"
import type { PanelControl } from "@/design/panel"
import { resolveControl } from "@/design/panel-arrangement"
import { ChartField, useHeldChart } from "@/editor/chart-data-section"
import { chartSettingEdited, roleColor, seriesColor, sliceColor, titled } from "@/editor/chart-setting-edit"

const waterfallRoles = ["increase", "decrease", "total"] as const
import { ControlView, DesignSection, SectionStrips } from "@/editor/design-panel"

const colorDesc: Desc = { kind: "color" }
const legendDesc: Desc = { kind: "choice", options: chartLegends }
const formatDesc: Desc = { kind: "choice", options: chartFormats }
const gapDesc: Desc = { kind: "number", unit: "count", min: 0, max: chartLimits.gap }

function control(field: string, label: string, desc: Desc, value: unknown, extra: Partial<PanelControl> = {}) {
  const change = () => ({ target: { slide: "every" as const, role: "chart" as const } })
  return {
    ...resolveControl({
      trait: "chart",
      field,
      label,
      desc,
      value,
      mixed: false,
      inherited: false,
      reset: null,
      change,
    }),
    ...extra,
  }
}

function legendControl(chart: ChartValue): PanelControl {
  return control("legend", chartCopy.legend, legendDesc, chartLegend(chart) ?? "none", {
    choices: chartLegends.map((value) => ({ value, label: chartCopy.legends[value] })),
  })
}

function formatControl(labels: ChartFormat): PanelControl {
  const shown = control("format", chartCopy.format, formatDesc, labels, {
    choices: chartFormats.map((value) => ({ value, label: chartCopy.formats[value] })),
  })
  return { ...shown, look: { ...shown.look, name: { show: "hidden" }, form: "list" } }
}

function colorStrips(chart: ChartValue): readonly (readonly PanelControl[])[] {
  if (chart.kind === "waterfall")
    return waterfallRoles.map((role) => [
      control(`role.${role}`, chartCopy.roles[role], colorDesc, roleColor(chart, role)),
    ])
  if (chart.kind === "pie")
    return chart.categories.map((category, at) => [
      control(`slice.${String(at)}`, category.trim(), colorDesc, sliceColor(chart, at)),
    ])
  return chart.series.map((series, at) => [
    control(`color.${String(at)}`, series.name, colorDesc, seriesColor(chart, at)),
  ])
}

function ChartCheck(props: { readonly label: string; readonly on: boolean; readonly onChange: (on: boolean) => void }) {
  return (
    <label className="flex h-[var(--control-dense)] min-w-0 items-center gap-2 text-[length:var(--type-caption)] text-foreground">
      <input
        type="checkbox"
        data-focus-ring
        checked={props.on}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
        className="size-3.5 shrink-0 accent-[var(--primary)]"
      />
      <span className="truncate">{props.label}</span>
    </label>
  )
}

export function ChartSettingsSection(props: {
  readonly deck: DesignDeck
  readonly node: ElementId
  readonly palette: Palette
}) {
  const { chart, save } = useHeldChart(props.deck, props.node)
  if (chart === null) return null
  const change = (field: string, chosen: unknown) => save((fresh) => chartSettingEdited(fresh, field, chosen))
  const onChange = (changed: PanelControl, chosen: unknown) => {
    if (chosen !== null) change(changed.field, chosen)
  }
  const pie = chart.kind === "pie"
  const gap = control("gap", chartCopy.gap, gapDesc, chart.gap ?? chartGap)
  return (
    <div data-chart-settings>
      <DesignSection title={chartCopy.chart}>
        <div className="flex flex-col gap-1">
          <span className={controlLabel}>{chartCopy.title}</span>
          <ChartField
            label={chartCopy.title}
            value={chart.title ?? ""}
            onCommit={(text) => save((fresh) => titled(fresh, "title", text))}
          />
        </div>
        <ControlView
          control={legendControl(chart)}
          palette={props.palette}
          onChange={(chosen) => onChange(legendControl(chart), chosen)}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
          <ChartCheck
            label={chartCopy.labels}
            on={chart.labels !== undefined}
            onChange={(on) => change("labels", on)}
          />
          {chart.labels === undefined ? null : (
            <ControlView
              control={formatControl(chart.labels)}
              palette={props.palette}
              onChange={(chosen) => change("format", chosen)}
            />
          )}
        </div>
        {pie ? null : (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
            <ChartCheck label={chartCopy.axis} on={chart.axis !== false} onChange={(on) => change("axis", on)} />
            <ChartCheck
              label={chartCopy.gridlines}
              on={chart.gridlines !== false}
              onChange={(on) => change("gridlines", on)}
            />
          </div>
        )}
        {pie ? null : (
          <div className="flex flex-col gap-1">
            <span className={controlLabel}>{chartCopy.axisTitles}</span>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <ChartField
                label={chartCopy.valueTitle}
                hint={chartCopy.valueHint}
                value={chart.valueTitle ?? ""}
                onCommit={(text) => save((fresh) => titled(fresh, "valueTitle", text))}
              />
              <ChartField
                label={chartCopy.categoryTitle}
                hint={chartCopy.categoryHint}
                value={chart.categoryTitle ?? ""}
                onCommit={(text) => save((fresh) => titled(fresh, "categoryTitle", text))}
              />
            </div>
          </div>
        )}
        {chartBars(chart.kind) ? (
          <NumberField
            control={gap}
            palette={props.palette}
            onChange={(chosen) => change("gap", chosen)}
            unit={designCopy.percent}
            kind="count"
          />
        ) : null}
        <SectionStrips strips={colorStrips(chart)} palette={props.palette} onChange={onChange} />
      </DesignSection>
    </div>
  )
}
