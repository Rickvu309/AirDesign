import {
  fadedColor,
  openRegister,
  readColor,
  readSlideId,
  readTableValue,
  readTextValue,
  shapeOf,
  slideNode,
  type Color,
  type ElementId,
} from "@airdesign/document"
import { ownBackground, paintReader, readSlides } from "@airdesign/pptx"
import { changeDesign, fileValue } from "@/design/design-change"
import { shownHex } from "@/design/color-choices"
import { replaceSelectionColor, type ColorSource } from "@/design/selection-colors"
import { deviceScope } from "@/design/trait-edit"
import { designShown } from "@/design-shown"
import { fieldsOf, readsOf, themeAt, usePalette, type DesigningDeck } from "./live-design-panel"
import { SelectionColorsSection } from "./selection-colors-section"

function colorSources(deck: DesigningDeck, nodes: readonly ElementId[]): readonly ColorSource[] {
  const { shown } = deck
  const parts = shown.displayParts.current
  const slide = readSlideId(readSlides(parts)[shown.current]?.slide)
  if (slide === undefined) return []
  const scope = deviceScope(shown.shownParts.current, shown.shownRegister.current ?? openRegister("", ""))
  const all = shown.store.current.slides()[shown.current]?.elements ?? []
  const included = new Set(nodes.length === 0 ? all : nodes)
  for (const node of all) {
    let parent = scope.view(node)?.parent
    while (parent != null) {
      if (included.has(parent)) {
        included.add(node)
        break
      }
      parent = scope.view(parent)?.parent
    }
  }
  const sources = all
    .filter((node) => included.has(node) && node !== slideNode(slide, "slide"))
    .map((node): ColorSource => {
      const fields = fieldsOf(parts, node) ?? {}
      if (scope.view(node)?.facts.kind === "table") {
        const table =
          readTableValue(shown.store.current.getElement(node)?.text ?? "") ??
          readTableValue(fileValue(shown, node) ?? "")
        return table === null
          ? { node, fields }
          : { node, textColor: { scheme: "tx1" }, fields: { ...fields, "table.value": { value: table, own: true } } }
      }
      const text = readTextValue(shown.store.current.getElement(node)?.text ?? scope.view(node)?.value ?? "")
      if (text === null) return { node, fields }
      const textColor = readColor(readsOf(parts, node)["text.color"]?.value) ?? { scheme: "tx1" }
      const at = shapeOf(node)
      const part = readSlides(parts)[shown.current]?.part
      const painted =
        part === undefined
          ? undefined
          : paintReader(parts)
              .slide(part)
              .elements.find((element) => element.shape === at.shape)?.text
      const textColors = (paragraph: number, run: number): Color | undefined => {
        const color = painted?.paragraphs[paragraph]?.runs[run]?.color
        if (color == null) return undefined
        const nominal =
          shownHex(textColor, themeAt(parts, shown.current)) === color.hex.toUpperCase()
            ? textColor
            : { rgb: color.hex.toUpperCase() }
        return fadedColor(nominal, Math.round(color.alpha * 100000))
      }
      const { "text.color": _ignored, ...rest } = fields
      return { node, textColor, textColors, fields: { ...rest, "text.value": { value: text, own: true } } }
    })
  if (nodes.length === 0) {
    const part = readSlides(parts)[shown.current]?.part
    const fill = part === undefined ? null : ownBackground(parts, part)
    const background = fill === null ? undefined : { value: fill, own: true }
    const fallback = designShown(parts, shown.current)?.background.value
    sources.push({
      node: slideNode(slide, "slide"),
      fields: {
        "fill.value": background ?? { value: fallback === undefined ? undefined : { solid: fallback }, own: false },
      },
    })
  }
  return sources
}

export function LiveSelectionColors({ deck, nodes }: { deck: DesigningDeck; nodes: readonly ElementId[] }) {
  const palette = usePalette(deck)
  return (
    <SelectionColorsSection
      sources={colorSources(deck, nodes)}
      palette={palette}
      onPick={(hex, color) =>
        changeDesign(deck, () => replaceSelectionColor(colorSources(deck, nodes), hex, color, palette))
      }
    />
  )
}
