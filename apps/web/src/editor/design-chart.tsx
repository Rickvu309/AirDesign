import * as doom from "@airdesign/doom"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { Fragment, type FocusEvent, type KeyboardEvent } from "react"
import { cn } from "@/lib/class-names"
import { editorCopy } from "@/copy/editor-copy"
import { composing } from "@/lib/composing"
import { NumberField } from "./number-cell"
import { PanelSection } from "./panel-fields"
import { roundedShown } from "@/design/shown-number"
import { propOf } from "@airdesign/doom"
import {
  chartAddRow,
  chartAddSeries,
  chartCell,
  chartDropRow,
  chartRow,
  chartSeriesName,
  chartWrites,
} from "./chart-theme-writes"

const wordsClass =
  "min-w-0 flex-1 bg-transparent text-[length:var(--type-caption)] leading-[var(--panel-label-leading)] outline-none"

type WordsField = HTMLTextAreaElement | HTMLInputElement

function WordsCell(props: {
  readonly label: string
  readonly value: string
  readonly onCommit: (words: string, field: WordsField) => void
  readonly truncate?: boolean
  readonly className?: string
}) {
  const onKeyDown = (event: KeyboardEvent<WordsField>) => {
    if (composing(event)) return
    if (event.key !== "Enter") return
    event.preventDefault()
    event.currentTarget.blur()
  }
  const onBlur = (event: FocusEvent<WordsField>) =>
    props.onCommit(event.currentTarget.value.replaceAll("\n", " "), event.currentTarget)
  return (
    <div
      data-focus-ring
      className={cn("flex min-h-8 min-w-0 items-center rounded-lg bg-muted px-2.5 py-1", props.className)}
    >
      {props.truncate === true ? (
        <input
          aria-label={props.label}
          title={props.value}
          defaultValue={props.value}
          className={cn(wordsClass, "w-0 truncate")}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        />
      ) : (
        <textarea
          aria-label={props.label}
          defaultValue={props.value}
          rows={1}
          className={cn(wordsClass, "resize-none overflow-hidden break-words w-0 field-sizing-content")}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        />
      )}
    </div>
  )
}

const valueWidth = (digits: number) => `min(7.75rem, max(4.5rem, ${String(digits + 1)}ch + 1.75rem))`

const digitsOf = (values: readonly number[]) =>
  values.reduce((most, value) => Math.max(most, roundedShown(value, 2).text.length), 0)

const valueColumn = (chart: doom.Chart, at: number) =>
  `minmax(4.5rem, ${valueWidth(digitsOf(chart.series[at]?.values ?? []))})`

const categoryColumn = (chart: doom.Chart) => {
  const word = Math.max(0, ...chart.categories.flatMap((category) => category.split(/\s+/).map((part) => part.length)))
  return `clamp(5rem, calc(${String(word)}ch + 2.75rem), 8rem)`
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
  const categoryTrack = categoryColumn(chart)
  return (
    <PanelSection title={null} name="chart">
      <Select
        value={chart.kind}
        onValueChange={(kind) => change(doom.chartWithKind(chart, kind as doom.Chart["kind"]))}
      >
        <SelectTrigger
          aria-label={editorCopy.chartKind}
          className="h-[var(--control-dense)] w-full rounded-[var(--shape-control)] border-0 bg-white text-[length:var(--type-caption)] shadow-[inset_0px_0px_0px_1px_var(--field-edge)] data-[size=default]:h-[var(--control-dense)]"
        >
          <SelectValue>
            {(value: string | null) => editorCopy.kinds[(value ?? chart.kind) as doom.Chart["kind"]]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {kinds.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {editorCopy.kinds[kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center justify-between text-[length:var(--type-caption)]">
        {editorCopy.chartLabels}
        <Switch
          aria-label={editorCopy.chartLabels}
          checked={chart.labels === true}
          onCheckedChange={(on) => change({ ...chart, labels: on })}
        />
      </label>
      <div
        role="group"
        aria-label={editorCopy.chartData}
        className="-my-0.5 -mr-0.5 min-w-0 overflow-x-auto py-0.5 pr-0.5"
        data-chart-data=""
      >
        <div
          className="grid w-max min-w-full items-center gap-1"
          style={{
            gridTemplateColumns: `${categoryTrack} ${chart.series.map((_, at) => valueColumn(chart, at)).join(" ")}`,
          }}
        >
          <span />
          {chart.series.map((series, at) => (
            <WordsCell
              key={`${String(at)}|${series.name}`}
              label={editorCopy.seriesName(at + 1)}
              value={series.name}
              truncate={chart.series.length > 1}
              onCommit={(words, field) => {
                const next = chartSeriesName(chart, at, words)
                if (next === chart) field.value = series.name
                else change(next)
              }}
            />
          ))}
          {chart.categories.map((category, row) => (
            <Fragment key={row}>
              <div className="flex min-w-0 items-center rounded-lg bg-muted" data-chart-category="">
                <WordsCell
                  key={category}
                  label={`${editorCopy.chartData} ${String(row + 1)}`}
                  value={category}
                  className="flex-1 bg-transparent pr-0"
                  onCommit={(words) => words !== category && change(chartRow(chart, row, words))}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={editorCopy.dropRow(category)}
                  onClick={() => change(chartDropRow(chart, row))}
                >
                  <Trash2 />
                </Button>
              </div>
              {chart.series.map((series, at) => (
                <div key={at} className="min-w-0">
                  <NumberField
                    label={String(at + 1)}
                    hideLabel
                    value={series.values[row]}
                    onCommit={(value) => change(chartCell(chart, at, row, value))}
                  />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => change(chartAddRow(chart))}>
            <Plus /> {editorCopy.addRow}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => change(chartAddSeries(chart))}>
            <Plus /> {editorCopy.addSeries}
          </Button>
        </div>
      </div>
    </PanelSection>
  )
}
