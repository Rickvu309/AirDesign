import type { scene } from "@airdesign/document"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowLeftRight,
  ArrowUpDown,
  Plus,
  Square,
  Trash2,
} from "lucide-react"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import type { PanelContext } from "./design-parts"
import { FieldRow, NumberField, PanelSection, Segmented } from "./panel-fields"
import { propOf } from "./node-props"
import { shownOf } from "./panel-model"
import {
  chartAddRow,
  chartAddSeries,
  chartCell,
  chartDropRow,
  chartRow,
  chartWrites,
  textFieldWrites,
} from "./panel-writes"

const styles = Object.keys(sceneEditorCopy.textStyles) as readonly scene.TextStyleName[]

const textAligns = [
  { value: "left", label: sceneEditorCopy.alignLeft, icon: <AlignLeft className="size-4" /> },
  { value: "center", label: sceneEditorCopy.alignCenter, icon: <AlignCenter className="size-4" /> },
  { value: "right", label: sceneEditorCopy.alignRight, icon: <AlignRight className="size-4" /> },
  { value: "justify", label: sceneEditorCopy.alignJustify, icon: <AlignJustify className="size-4" /> },
] as const

const verticals = [
  { value: "top", label: sceneEditorCopy.alignTop, icon: <AlignVerticalJustifyStart className="size-4" /> },
  { value: "center", label: sceneEditorCopy.alignMiddle, icon: <AlignVerticalJustifyCenter className="size-4" /> },
  { value: "bottom", label: sceneEditorCopy.alignBottom, icon: <AlignVerticalJustifyEnd className="size-4" /> },
] as const

const resizes = [
  { value: "widthAndHeight", label: sceneEditorCopy.autoWidth, icon: <ArrowLeftRight className="size-4" /> },
  { value: "height", label: sceneEditorCopy.autoHeight, icon: <ArrowUpDown className="size-4" /> },
  { value: "fixed", label: sceneEditorCopy.fixedSize, icon: <Square className="size-4" /> },
] as const

export function TextSection({ ids, view, push }: PanelContext) {
  const text = shownOf(view, ids, "text")
  const now = text.value
  const align = now?.paras[0]?.align ?? "left"
  return (
    <PanelSection title={sceneEditorCopy.text} name="text">
      {text.mixed || now === undefined ? null : (
        <>
          <Select
            value={now.style}
            onValueChange={(style) => push(textFieldWrites(view, ids, { style: style as scene.TextStyleName }))}
          >
            <SelectTrigger aria-label={sceneEditorCopy.textStyle} className="h-7 w-full">
              <SelectValue>
                {(value: string | null) => sceneEditorCopy.textStyles[(value ?? now.style) as scene.TextStyleName]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {styles.map((style) => (
                <SelectItem key={style} value={style}>
                  {sceneEditorCopy.textStyles[style]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmented
            label={sceneEditorCopy.textAlign}
            value={align}
            options={textAligns}
            onChange={(next) => push(textFieldWrites(view, ids, { align: next }))}
          />
          <Segmented
            label={sceneEditorCopy.alignment}
            value={now.alignV}
            options={verticals}
            onChange={(alignV) => push(textFieldWrites(view, ids, { alignV }))}
          />
          <Segmented
            label={sceneEditorCopy.text}
            value={now.resize === "truncate" ? "fixed" : now.resize}
            options={resizes}
            onChange={(resize) => push(textFieldWrites(view, ids, { resize }))}
          />
        </>
      )}
    </PanelSection>
  )
}

const kinds = ["column", "bar", "line", "pie", "stacked"] as const

export function ChartSection({ ids, view, push }: PanelContext) {
  const [id] = ids
  const chart = id === undefined ? undefined : propOf(view.nodes.get(id), "chart")
  if (id === undefined || chart === undefined) return null
  const change = (next: scene.Chart) => push(chartWrites(id, next))
  return (
    <PanelSection title={sceneEditorCopy.chart} name="chart">
      <Select value={chart.kind} onValueChange={(kind) => change({ ...chart, kind: kind as scene.Chart["kind"] })}>
        <SelectTrigger aria-label={sceneEditorCopy.chartKind} className="h-7 w-full">
          <SelectValue>
            {(value: string | null) => sceneEditorCopy.kinds[(value ?? chart.kind) as scene.Chart["kind"]]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {kinds.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {sceneEditorCopy.kinds[kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center justify-between text-[length:var(--type-dense)]">
        {sceneEditorCopy.chartLabels}
        <Switch
          aria-label={sceneEditorCopy.chartLabels}
          checked={chart.labels === true}
          onCheckedChange={(on) => change({ ...chart, labels: on })}
        />
      </label>
      <div role="group" aria-label={sceneEditorCopy.chartData} className="flex flex-col gap-1" data-chart-data="">
        {chart.categories.map((category, row) => (
          <div key={row} className="flex items-center gap-1">
            <input
              aria-label={`${sceneEditorCopy.chartData} ${String(row + 1)}`}
              defaultValue={category}
              key={category}
              className="h-7 w-16 min-w-0 rounded-md bg-white px-1.5 text-[length:var(--type-dense)] outline-none"
              onBlur={(event) =>
                event.currentTarget.value !== category && change(chartRow(chart, row, event.currentTarget.value))
              }
            />
            {chart.series.map((series, at) => (
              <div key={at} className="min-w-0 flex-1">
                <NumberField
                  label={String(at + 1)}
                  value={series.values[row]}
                  onCommit={(value) => change(chartCell(chart, at, row, value))}
                />
              </div>
            ))}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={sceneEditorCopy.dropRow(category)}
              onClick={() => change(chartDropRow(chart, row))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <FieldRow label="">
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => change(chartAddRow(chart))}>
              <Plus /> {sceneEditorCopy.addRow}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => change(chartAddSeries(chart))}>
              <Plus /> {sceneEditorCopy.addSeries}
            </Button>
          </span>
        </FieldRow>
      </div>
    </PanelSection>
  )
}
