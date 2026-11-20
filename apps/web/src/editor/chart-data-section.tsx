import {
  chartAccent,
  chartKinds,
  chartLimits,
  readChartValue,
  shapeOf,
  slideId,
  writeChartValue,
  type CellTexts,
  type ChartKind,
  type ChartSeries,
  type ChartValue,
  type Color,
  type ElementId,
} from "@airdesign/document"
import { Minus, Plus } from "lucide-react"
import { manyCells, readPastedCells } from "@airdesign/render"
import { useState, useSyncExternalStore, type ClipboardEvent, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { chartCopy } from "@/copy/chart-copy"
import { changeDesign, fileChartFormatsOf, fileValue, type DesignDeck } from "@/design/design-change"
import { gridFormat, gridNumber, gridParse } from "@/editor/chart-grid-number"
import { pastedChart, withColors, withRow, withSeries } from "@/editor/chart-grid-paste"
import { chartKindIcons } from "@/editor/chart-tool"
import { DesignSection } from "@/editor/design-panel"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"
import { heldChart } from "@/live-repaint"

const fieldLook =
  "min-w-0 rounded-[var(--shape-control)] bg-white px-1.5 text-[length:var(--type-caption)] text-foreground md:text-[length:var(--type-caption)]"

export function ChartField(props: {
  readonly label: string
  readonly value: string
  readonly hint?: string
  readonly numeric?: boolean
  readonly onCommit: (text: string) => void
  readonly onCells?: (cells: CellTexts) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft !== null && draft !== props.value) props.onCommit(draft)
    setDraft(null)
  }
  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur()
  }
  return (
    <Input
      data-focus-ring
      aria-label={props.label}
      placeholder={props.hint}
      value={draft ?? props.value}
      inputMode={props.numeric === true ? "decimal" : undefined}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={key}
      onPaste={(event) => pastedCells(event, props.onCells, () => setDraft(null))}
      className={cn("h-[var(--control-dense)]", fieldLook, props.numeric === true && "text-right")}
    />
  )
}

function pastedCells(
  event: ClipboardEvent<HTMLElement>,
  onCells: ((cells: CellTexts) => void) | undefined,
  drop: () => void,
) {
  const cells = readPastedCells(event.clipboardData)
  if (onCells === undefined || !manyCells(cells)) return
  event.preventDefault()
  drop()
  onCells(cells)
}

function ChartLabelField(props: {
  readonly label: string
  readonly value: string
  readonly onCommit: (text: string) => void
  readonly onCells: (cells: CellTexts) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft !== null && draft !== props.value) props.onCommit(draft)
    setDraft(null)
  }
  const key = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    event.currentTarget.blur()
  }
  return (
    <Textarea
      data-focus-ring
      data-chart-label
      rows={1}
      aria-label={props.label}
      value={draft ?? props.value}
      onChange={(event) => setDraft(event.currentTarget.value.replaceAll("\n", " "))}
      onBlur={commit}
      onKeyDown={key}
      onPaste={(event) => pastedCells(event, props.onCells, () => setDraft(null))}
      className={cn("min-h-[var(--control-dense)] resize-none py-1 leading-snug", fieldLook)}
    />
  )
}

function IconButton(props: { readonly label: string; readonly add: boolean; readonly onClick: () => void }) {
  const Icon = props.add ? Plus : Minus
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={props.label}
      onClick={props.onClick}
      className="size-7 rounded-md text-quiet active:translate-y-0"
    >
      <Icon size={14} />
    </Button>
  )
}

function withValue(chart: ChartValue, row: number, column: number, value: number): ChartValue {
  return {
    ...chart,
    series: chart.series.map((series, at) =>
      at === column
        ? { ...series, values: series.values.map((each, index) => (index === row ? value : each)) }
        : series,
    ),
  }
}

function pointColors(chart: ChartValue, series: ChartSeries, at: number): readonly Color[] | undefined {
  if (chart.kind === "pie" && at === 0) return series.colors ?? chart.categories.map((_, point) => chartAccent(point))
  return series.colors
}

function withoutRow(chart: ChartValue, row: number): ChartValue {
  const kept = (_: unknown, at: number) => at !== row
  return {
    ...chart,
    categories: chart.categories.filter(kept),
    series: chart.series.map((series, at) =>
      withColors(
        { ...series, values: series.values.filter(kept) },
        pointColors(chart, series, at)?.filter(kept),
        chart.kind === "pie",
      ),
    ),
  }
}

export type ChartEdit = (edit: (fresh: ChartValue) => ChartValue) => void

export function useHeldChart(deck: DesignDeck, node: ElementId): { chart: ChartValue | null; save: ChartEdit } {
  const { shown } = deck
  const held = () => heldChart(shown.shownRegister.current, node) ?? fileValue(shown, node)
  const shownValue = useSyncExternalStore(shown.store.current.slideSubscribe(slideId(shapeOf(node).slide)), held)
  const chart = shownValue === null ? null : readChartValue(shownValue)
  const save: ChartEdit = (edit) =>
    changeDesign(deck, () => {
      const before = held()
      const fresh = (before === null ? null : readChartValue(before)) ?? chart
      if (fresh === null) return []
      return { target: { node }, chart: { value: writeChartValue(edit(fresh)) } }
    })
  return { chart, save }
}

export function ChartDataSection(props: { readonly deck: DesignDeck; readonly node: ElementId }) {
  const { chart, save } = useHeldChart(props.deck, props.node)
  if (chart === null) return null
  const own = fileChartFormatsOf(props.deck.shown, props.node)
  const formats = chart.series.map((_, column) => gridFormat(own[column] ?? own[0], chart))
  const many = chart.kind !== "pie"
  const columns = chart.series.length
  const pasteAt = (row: number, column: number) => (cells: CellTexts) =>
    save((fresh) =>
      pastedChart(fresh, { row, column }, cells, (text, series) =>
        gridParse(text, formats[series] ?? formats[0] ?? "General"),
      ),
    )
  return (
    <div data-chart-data>
      <DesignSection title={chartCopy.data}>
        <div
          role="group"
          data-segments
          aria-label={chartCopy.type}
          className="flex h-[var(--control-dense)] items-center rounded-[var(--shape-control)] bg-[var(--panel-track)] p-0"
        >
          {chartKinds.map((kind: ChartKind) => {
            const chosen = chart.kind === kind
            return (
              <Button
                key={kind}
                type="button"
                variant="ghost"
                aria-pressed={chosen}
                aria-label={chartCopy.types[kind]}
                title={chartCopy.types[kind]}
                onClick={() => {
                  if (!chosen) save((fresh) => ({ ...fresh, kind }))
                }}
                className={cn(
                  "h-[var(--control-dense)] min-w-0 flex-1 rounded-[var(--panel-segment-radius)] px-0 active:translate-y-0",
                  chosen
                    ? "bg-white text-foreground shadow-[inset_0_0_0_1px_var(--panel-edge)] hover:bg-white"
                    : "text-quiet hover:bg-transparent hover:text-foreground",
                )}
              >
                <EditorIcon name={chartKindIcons[kind]} strokeWidth={1.5} />
              </Button>
            )
          })}
        </div>
        <div
          className="grid items-start gap-1"
          style={{
            gridTemplateColumns: `minmax(3.5rem, 1.4fr) repeat(${String(columns)}, minmax(3rem, 1fr)) 1.75rem`,
          }}
        >
          <span />
          {chart.series.map((series, column) => (
            <div key={`name ${String(column)}`} className="flex min-w-0 items-center">
              <ChartField
                label={chartCopy.series(column + 1)}
                value={series.name}
                onCells={pasteAt(-1, column + 1)}
                onCommit={(name) =>
                  save((fresh) => ({
                    ...fresh,
                    series: fresh.series.map((each, at) => (at === column ? { ...each, name } : each)),
                  }))
                }
              />
            </div>
          ))}
          {many && columns < chartLimits.series ? (
            <IconButton label={chartCopy.addSeries} add onClick={() => save(withSeries)} />
          ) : (
            <span />
          )}
          {chart.categories.map((category, row) => [
            <ChartLabelField
              key={`label ${String(row)}`}
              label={chartCopy.category(row + 1)}
              value={category}
              onCells={pasteAt(row, 0)}
              onCommit={(text) =>
                save((fresh) => ({
                  ...fresh,
                  categories: fresh.categories.map((each, at) => (at === row ? text : each)),
                }))
              }
            />,
            ...chart.series.map((series, column) => (
              <ChartField
                key={`value ${String(row)} ${String(column)}`}
                label={chartCopy.value(row + 1, column + 1)}
                value={gridNumber(series.values[row] ?? 0, formats[column] ?? "General")}
                numeric
                onCells={pasteAt(row, column + 1)}
                onCommit={(text) => {
                  const value = gridParse(text, formats[column] ?? "General")
                  if (value !== null && value !== series.values[row])
                    save((fresh) => withValue(fresh, row, column, value))
                }}
              />
            )),
            chart.categories.length > 1 ? (
              <IconButton
                key={`remove ${String(row)}`}
                label={chartCopy.removeRow(row + 1)}
                add={false}
                onClick={() => save((fresh) => withoutRow(fresh, row))}
              />
            ) : (
              <span key={`remove ${String(row)}`} />
            ),
          ])}
        </div>
        <div className="flex items-center gap-1">
          {chart.categories.length < chartLimits.categories ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => save(withRow)}
              className="h-7 gap-1 px-1.5 text-[length:var(--type-caption)] text-quiet"
            >
              <Plus size={14} />
              {chartCopy.addRow}
            </Button>
          ) : null}
          {many && columns > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => save((fresh) => ({ ...fresh, series: fresh.series.slice(0, -1) }))}
              className="h-7 gap-1 px-1.5 text-[length:var(--type-caption)] text-quiet"
            >
              <Minus size={14} />
              {chartCopy.removeSeries(columns)}
            </Button>
          ) : null}
        </div>
      </DesignSection>
    </div>
  )
}
