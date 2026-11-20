import type { ElementId } from "@airdesign/document"
import type { ReactNode } from "react"
import type { Palette } from "@/design/color-choices"
import type { DesignDeck } from "@/design/design-change"
import { ChartDataSection } from "@/editor/chart-data-section"
import { ChartSettingsSection } from "@/editor/chart-settings-section"
import { TableCellsSection, type TableCells } from "@/editor/table-cells-section"

export function kindSection(props: {
  readonly deck: DesignDeck & { readonly tableCells?: TableCells | null }
  readonly node: ElementId
  readonly kind: string | null
  readonly value: string | null
  readonly palette: Palette
}): { readonly children?: ReactNode } {
  const { deck, node, value } = props
  if (props.kind === "chart")
    return {
      children: (
        <>
          <ChartDataSection deck={deck} node={node} />
          <ChartSettingsSection deck={deck} node={node} palette={props.palette} />
        </>
      ),
    }
  if (props.kind !== "table") return {}
  return {
    children: (
      <TableCellsSection deck={deck} node={node} value={value} picked={deck.tableCells} palette={props.palette} />
    ),
  }
}
