import {
  changedTable,
  readTableValue,
  traits,
  writeTableValue,
  type CellFill,
  type CellRange,
  type Desc,
  type ElementId,
  type TableChange,
  type TableValue,
} from "@airdesign/document"
import { tableCopy } from "@/copy/table-copy"
import type { Palette } from "@/design/color-choices"
import { changeDesign, type DesignDeck } from "@/design/design-change"
import type { PanelControl } from "@/design/panel"
import { resolveControl } from "@/design/panel-arrangement"
import { DesignSection, SectionStrips } from "@/editor/design-panel"
import { cellsShown, type ShownValue } from "@/editor/table-cells-shown"

export type TableCells = { readonly node: ElementId; readonly cells: CellRange }

function wholeTable(table: TableValue): CellRange {
  return { rows: [0, table.rows.length - 1], columns: [0, (table.rows[0]?.cells.length ?? 1) - 1] }
}

function cellControl(trait: "border" | "text", field: string, label: string, desc: Desc, shown: ShownValue<unknown>) {
  const change = () => ({ target: { slide: "every" as const, role: "table" as const } })
  const { value, mixed } = shown
  return resolveControl({ trait, field, label, desc, value, mixed, inherited: false, reset: null, change })
}

export function TableCellsSection(props: {
  readonly deck: DesignDeck
  readonly node: ElementId
  readonly value: string | null
  readonly picked: TableCells | null | undefined
  readonly palette: Palette
}) {
  const { deck, node, value, picked, palette } = props
  const table = value === null ? null : readTableValue(value)
  if (table === null) return null
  const cells = picked?.node === node ? picked.cells : wholeTable(table)
  const shown = cellsShown(table, cells)
  const text = traits.text.inputs
  const fill = cellControl("border", "color", tableCopy.cellFill, text.color.desc, shown.fill)
  const ink = cellControl("border", "color", tableCopy.textColor, text.color.desc, shown.color)
  const strips: readonly (readonly PanelControl[])[] = [
    [fill, ink],
    [cellControl("text", "size", tableCopy.textSize, text.size.desc, shown.size)],
    [
      cellControl("text", "bold", tableCopy.bold, text.bold.desc, shown.bold),
      cellControl("text", "italic", tableCopy.italic, text.italic.desc, shown.italic),
    ],
    [cellControl("text", "align", tableCopy.align, text.align.desc, shown.align)],
  ]
  function onChange(control: PanelControl, chosen: unknown) {
    if (table === null) return
    const change: TableChange =
      control === fill
        ? { change: "fill", cells, fill: { solid: chosen } as CellFill }
        : { change: "style", cells, style: { [control === ink ? "color" : control.field]: chosen } }
    const next = changedTable(table, change)
    if (next === null || next === table) return
    changeDesign(deck, () => ({ target: { node }, table: { value: writeTableValue(next) } }))
  }
  return (
    <div data-table-cells>
      <DesignSection title={tableCopy.cells}>
        <SectionStrips strips={strips} palette={palette} onChange={onChange} />
      </DesignSection>
    </div>
  )
}
