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
import { layersWithColor, replaceSelectionColor, type ColorSource } from "@/design/selection-colors"
import { deviceScope } from "@/design/trait-edit"
import { designShown } from "@/design-shown"
import { readsOf, templateColorsAt, usePalette, type DesigningDeck } from "./live-design-panel"
import { fieldsOf } from "./panel-fields"
import { SelectionColorsSection } from "./selection-colors-section"

function colorSources(deck: DesigningDeck, nodes: readonly ElementId[]): readonly ColorSource[] {
  const { shown } = deck
  const parts = shown.displayParts.current
  const listed = readSlides(parts)[shown.current]
  const slide = readSlideId(listed?.slide)
  if (slide === undefined || listed === undefined) return []
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
  const painted = new Map(
    paintReader(parts)
      .slide(listed.part)
      .elements.filter((layer) => layer.from === "slide")
      .map((layer) => [layer.shape, layer.text]),
  )
  const colors = templateColorsAt(parts, shown.current)
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
      const drawn = painted.get(shapeOf(node).shape)
      const textColors = (paragraph: number, run: number): Color | undefined => {
        const color = drawn?.paragraphs[paragraph]?.runs[run]?.color
        if (color == null) return undefined
        const nominal =
          shownHex(textColor, colors) === color.hex.toUpperCase() ? textColor : { rgb: color.hex.toUpperCase() }
        return fadedColor(nominal, Math.round(color.alpha * 100000))
      }
      const textFills = (paragraph: number, run: number) => {
        const fill = drawn?.paragraphs[paragraph]?.runs[run]?.fill
        return fill !== undefined && "gradient" in fill ? fill : undefined
      }
      const { "text.color": _color, "text.fill": _fill, ...rest } = fields
      return { node, textColor, textColors, textFills, fields: { ...rest, "text.value": { value: text, own: true } } }
    })
  if (nodes.length === 0) {
    const fill = ownBackground(parts, listed.part)
    const background = fill === null ? undefined : { value: fill, own: true }
    const fallback = designShown(parts, shown.current)?.background.value
    sources.push({
      node: slideNode(slide, "slide"),
      fields: {
        "fills.p0": background ?? { value: fallback === undefined ? undefined : { solid: fallback }, own: false },
      },
    })
  }
  return sources
}

export function LiveSelectionColors({ deck, nodes }: { deck: DesigningDeck; nodes: readonly ElementId[] }) {
  const palette = usePalette(deck)
  function selectColor(hex: string) {
    const slide = deck.shown.canvases.current(deck.shown.current)
    if (slide === null) return
    const matches = new Set(layersWithColor(colorSources(deck, []), hex, palette))
    const ids = slide.elements.flatMap((layer) =>
      layer.id === null || layer.backdrop === true || !matches.has(layer.id) ? [] : [layer.id],
    )
    if (ids.length > 0) deck.select?.({ ids, inside: null, acrossGroups: true })
  }
  return (
    <SelectionColorsSection
      sources={colorSources(deck, nodes)}
      palette={palette}
      onSelect={selectColor}
      onPick={(hex, color) =>
        changeDesign(deck, () => replaceSelectionColor(colorSources(deck, nodes), hex, color, palette))
      }
    />
  )
}
