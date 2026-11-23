import * as doom from "@airdesign/doom"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { Fragment } from "react"
import { doomEditorCopy } from "@/copy/doom-editor-copy"
import { NumberField, PanelSection } from "./panel-fields"
import { propOf } from "./node-props"
import {
  chartAddRow,
  chartAddSeries,
  chartCell,
  chartDropRow,
  chartRow,
  chartSeriesName,
  chartWrites,
} from "./chart-theme-writes"

function WordsCell(props: {
  readonly label: string
  readonly value: string
  readonly onCommit: (words: string, field: HTMLInputElement) => void
}) {
  return (
    <div data-focus-ring className="flex h-8 min-w-0 items-center rounded-lg bg-muted px-2.5">
      <input
        aria-label={props.label}
        defaultValue={props.value}
        className="min-w-0 flex-1 bg-transparent text-[length:var(--type-caption)] outline-none"
        onBlur={(event) => props.onCommit(event.currentTarget.value, event.currentTarget)}
      />
    </div>
  )
}

const kinds = ["column", "bar", "line", "pie", "stacked"] as const

export function ChartSection({
  id,
  view,
  push,
}: {
  readonly id: doom.NodeId
  readonly view: doom.Doom
  readonly push: (writes: readonly doom.Write[]) => void
}) {
  const chart = propOf(view.nodes.get(id), "chart")
  if (chart === undefined) return null
  const change = (next: doom.Chart) => push(chartWrites(id, next))
  return (
    <PanelSection title={doomEditorCopy.chart} name="chart">
      <Select value={chart.kind} onValueChange={(kind) => change({ ...chart, kind: kind as doom.Chart["kind"] })}>
        <SelectTrigger
          aria-label={doomEditorCopy.chartKind}
          className="h-[var(--control-dense)] w-full rounded-[var(--shape-control)] border-0 bg-white text-[length:var(--type-caption)] shadow-[inset_0px_0px_0px_1px_var(--field-edge)] data-[size=default]:h-[var(--control-dense)]"
        >
          <SelectValue>
            {(value: string | null) => doomEditorCopy.kinds[(value ?? chart.kind) as doom.Chart["kind"]]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {kinds.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {doomEditorCopy.kinds[kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center justify-between text-[length:var(--type-caption)]">
        {doomEditorCopy.chartLabels}
        <Switch
          aria-label={doomEditorCopy.chartLabels}
          checked={chart.labels === true}
          onCheckedChange={(on) => change({ ...chart, labels: on })}
        />
      </label>
      <div
        role="group"
        aria-label={doomEditorCopy.chartData}
        className="-m-0.5 overflow-x-auto p-0.5"
        data-chart-data=""
      >
        <div
          className="grid items-center gap-1"
          style={{ gridTemplateColumns: `5rem repeat(${String(chart.series.length)}, minmax(4.5rem, 1fr)) 1.5rem` }}
        >
          <span />
          {chart.series.map((series, at) => (
            <WordsCell
              key={`${String(at)}|${series.name}`}
              label={doomEditorCopy.seriesName(at + 1)}
              value={series.name}
              onCommit={(words, field) => {
                const next = chartSeriesName(chart, at, words)
                if (next === chart) field.value = series.name
                else change(next)
              }}
            />
          ))}
          <span />
          {chart.categories.map((category, row) => (
            <Fragment key={row}>
              <WordsCell
                key={category}
                label={`${doomEditorCopy.chartData} ${String(row + 1)}`}
                value={category}
                onCommit={(words) => words !== category && change(chartRow(chart, row, words))}
              />
              {chart.series.map((series, at) => (
                <NumberField
                  key={at}
                  label={String(at + 1)}
                  hideLabel
                  value={series.values[row]}
                  onCommit={(value) => change(chartCell(chart, at, row, value))}
                />
              ))}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={doomEditorCopy.dropRow(category)}
                onClick={() => change(chartDropRow(chart, row))}
              >
                <Trash2 />
              </Button>
            </Fragment>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => change(chartAddRow(chart))}>
            <Plus /> {doomEditorCopy.addRow}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => change(chartAddSeries(chart))}>
            <Plus /> {doomEditorCopy.addSeries}
          </Button>
        </div>
      </div>
    </PanelSection>
  )
}
