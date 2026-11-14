import { elementId, writeTextValue, type ScopedElement } from "@airdesign/document"
import { formatCopy } from "@/copy/format-copy"
import { panelOf, type Swatch } from "@/design/panel"
import { haldenMist, haldenTeal, swatchNavy, swatchWhite } from "@/editor/design-panel-art"
import { ElementDesign } from "@/editor/design-panel"

const sampleColors = {
  dk1: "#111111",
  lt1: swatchWhite,
  dk2: swatchNavy,
  lt2: "#eef3f6",
  accent1: haldenTeal,
  accent2: haldenMist,
  accent3: "#e0a33a",
  accent4: "#c4553d",
  accent5: "#5f7d4a",
  accent6: "#6b5b95",
} as const

const palette: readonly Swatch[] = Object.entries(sampleColors).map(([scheme, css]) => ({
  scheme: scheme as keyof typeof sampleColors,
  css,
  name: formatCopy.colors[scheme as keyof typeof sampleColors],
}))

const title: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: true, grouped: false, animated: false },
  kept: [],
  value: writeTextValue([
    { from: 0, runs: [{ from: 0, text: "Q3 revenue grew 18%", size: 3600, bold: true, color: { scheme: "dk2" } }] },
  ]),
  box: { x: 685_800, y: 457_200, cx: 10_820_400, cy: 1_143_000 },
}

export function DesignElementArt() {
  return (
    <ElementDesign
      model={panelOf(title, {
        reads: {},
        moves: true,
        fields: {
          "fill.value": { value: { none: true }, own: false },
          "line.fill": { value: { none: true }, own: false },
        },
      })}
      kind="shape"
      palette={palette}
      onChange={() => undefined}
    />
  )
}
