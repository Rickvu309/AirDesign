import { openRegister, readLayout, type ElementId } from "@airdesign/document"
import type { CanvasSlide, Selection } from "@airdesign/render"
import { useEffect, useMemo, useRef } from "react"
import type { CommitOutcome } from "@/commit-edit"
import { changeDesign, type DesignDeck } from "@/design/design-change"
import { panelKind } from "@/design/panel-order"
import { deviceScope } from "@/design/trait-edit"
import { layerTree, type Layer } from "@/editor/layer-tree"
import { setLayerFlag } from "@/editor/layer-flags"
import { layerJoins } from "@/editor/layer-join"
import { LayersPanel, type LayerPick } from "@/editor/layers-panel"
import { fieldsOf } from "@/editor/panel-fields"
import { slideLayerRows, type LayerLook } from "@/editor/slide-layers"
import type { ElementChange } from "@/element-edit"
import { indexedRegister } from "@/indexed-register"

export type LayeringDeck = DesignDeck & {
  readonly selection: Selection
  readonly select: (selection: Selection) => void
  readonly changeElement: (change: ElementChange) => Promise<CommitOutcome | "closed">
}

function insideOf(slide: CanvasSlide | null, node: ElementId): ElementId | null {
  return slide?.elements.find((each) => each.id === node)?.group?.id ?? null
}

function layerSelection(slide: CanvasSlide | null, nodes: readonly ElementId[]): Selection {
  const insides = nodes.map((node) => insideOf(slide, node))
  const [first = null] = insides
  return insides.every((inside) => inside === first)
    ? { ids: nodes, inside: first }
    : { ids: nodes, inside: null, acrossGroups: true }
}

function useSlideTree(deck: LayeringDeck): readonly Layer[] {
  const { shown } = deck
  const file = shown.shownParts.current
  const parts = shown.displayParts.current
  const register = shown.shownRegister.current
  const slide = shown.store.current.slides()[shown.current]?.id
  return useMemo(() => {
    if (slide === undefined) return []
    const scope = deviceScope(file, register ?? openRegister("", ""))
    const laid = register === null ? null : indexedRegister(file, register)
    const look = (node: ElementId): LayerLook => {
      const view = scope.view(node)
      if (view === undefined) return { kind: "kept" }
      const found = panelKind(view, { reads: {}, moves: false, fields: fieldsOf(parts, node) })
      const kind = found === null || found === "many" ? "kept" : found
      const flow = view.facts.frame === "auto" && laid !== null ? readLayout(laid, node)?.flow : undefined
      return {
        kind,
        ...(view.backdrop === undefined ? {} : { backdrop: view.backdrop }),
        ...(flow === undefined || flow === "none" ? {} : { flow }),
      }
    }
    return layerTree(slideLayerRows(parts, slide, look))
  }, [file, parts, register, slide])
}

function canvasFrame(slide: CanvasSlide | null, node: ElementId): HTMLElement | null {
  const key = slide?.elements.find((each) => each.id === node)?.key
  if (key === undefined) return null
  return document.querySelector<HTMLElement>(`[data-slide-paint] [data-canvas-element="${CSS.escape(key)}"]`)
}

export function LiveLayers({
  deck,
  onHover,
}: {
  readonly deck: LayeringDeck
  readonly onHover: (node: ElementId | null) => void
}) {
  const tree = useSlideTree(deck)
  const canvas = deck.shown.canvases.current(deck.shown.current)
  const focusing = useRef<ElementId | null>(null)
  const { selection } = deck
  useEffect(() => {
    const node = focusing.current
    if (node === null || selection.ids.at(-1) !== node) return
    focusing.current = null
    const frame = canvasFrame(canvas, node)
    if (frame !== null && frame !== document.activeElement) frame.focus({ preventScroll: true })
  }, [selection, canvas])

  function select(nodes: readonly ElementId[], pick: LayerPick) {
    focusing.current = pick === "pointer" ? (nodes.at(-1) ?? null) : null
    deck.select(layerSelection(canvas, nodes))
  }

  return (
    <LayersPanel
      layers={{
        tree,
        selected: selection.ids,
        onSelect: select,
        onHover,
        onRename: (node, name) => changeDesign(deck, () => ({ target: { node }, identity: { name } })),
        onOrder: (node, before) => void deck.changeElement({ change: "order", node, move: { before } }),
        onMove: (node, parent, before, from) => void deck.changeElement({ change: "join", node, parent, before, from }),
        joins: (node, parent) => {
          const register = deck.shown.shownRegister.current
          return register !== null && layerJoins(deck.shown.shownParts.current, register, node, parent)
        },
        onFlag: (nodes, flag, on) => setLayerFlag(deck, nodes, flag, on),
      }}
    />
  )
}
