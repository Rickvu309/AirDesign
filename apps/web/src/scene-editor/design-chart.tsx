import type { scene } from "@airdesign/document"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import { NumberField, PanelSection } from "./panel-fields"
import { propOf } from "./node-props"
import { chartAddRow, chartAddSeries, chartCell, chartDropRow, chartRow, chartWrites } from "./chart-theme-writes"

const kinds = ["column", "bar", "line", "pie", "stacked"] as const

export function ChartSection({
  id,
  view,
  push,
}: {
  readonly id: scene.NodeId
  readonly view: scene.Scene
  readonly push: (writes: readonly scene.Write[]) => void
}) {
  const chart = propOf(view.nodes.get(id), "chart")
  if (chart === undefined) return null
  const change = (next: scene.Chart) => push(chartWrites(id, next))
  return (
    <PanelSection title={sceneEditorCopy.chart} name="chart">
      <Select value={chart.kind} onValueChange={(kind) => change({ ...chart, kind: kind as scene.Chart["kind"] })}>
        <SelectTrigger
          aria-label={sceneEditorCopy.chartKind}
          className="h-[var(--control-dense)] w-full rounded-[var(--shape-control)] border-0 bg-white text-[length:var(--type-caption)] shadow-[inset_0px_0px_0px_1px_var(--field-edge)] data-[size=default]:h-[var(--control-dense)]"
        >
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
      <label className="flex items-center justify-between text-[length:var(--type-caption)]">
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
              className="h-7 w-16 min-w-0 rounded-md bg-white px-1.5 text-[length:var(--type-caption)] outline-none"
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
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => change(chartAddRow(chart))}>
            <Plus /> {sceneEditorCopy.addRow}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => change(chartAddSeries(chart))}>
            <Plus /> {sceneEditorCopy.addSeries}
          </Button>
        </div>
      </div>
    </PanelSection>
  )
}
