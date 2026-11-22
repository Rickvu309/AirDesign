import { openRegister, readLayout, shapeOf, type ElementId } from "@airdesign/document"
import { textLayerName, textNamedNow } from "@airdesign/pptx"
import { boxOf, type CanvasSlide, type PaintStore, type Copied, type Moved, type Selection } from "@airdesign/render"
import { useEffect, useMemo, useReducer, useRef } from "react"
import type { CommitOutcome } from "@/editing/commit-edit"
import { changeDesign, type DesignDeck } from "@/design/design-change"
import { panelKind } from "@/design/panel-order"
import { deviceScope } from "@/design/trait-edit"
import { layerTree, type Layer } from "@/legacy-editor/layer-tree"
import { setLayerFlag } from "@/legacy-editor/layer-flags"
import { layerJoins } from "@/legacy-editor/layer-join"
import { LayersPanel, type LayerPick, type RenameRequest } from "@/legacy-editor/layers-panel"
import { fieldsOf } from "@/editor/panel-fields"
import { canvasFrame } from "@/legacy-editor/keys-back-to-canvas"
import { slideLayerRows, type LayerLook } from "@/legacy-editor/slide-layers"
import type { ElementChange } from "@/element-edit"
import { indexedRegister } from "@/editing/indexed-register"

export type LayeringDeck = DesignDeck & {
  readonly selection: Selection
  readonly select: (selection: Selection) => void
  readonly changeElement: (change: ElementChange) => Promise<CommitOutcome | "closed">
  readonly duplicateLayers?: (copies: readonly Moved[]) => Promise<readonly Copied[]>
}

function copiesOf(deck: LayeringDeck, slide: CanvasSlide | null, nodes: readonly ElementId[]): readonly Moved[] {
  const store = deck.shown.store.current
  return nodes.flatMap((id) => {
    const painted = slide?.elements.find((each) => each.id === id)?.box ?? null
    const box = store.getBox(id) ?? (painted === null ? null : boxOf(painted))
    return box === null ? [] : [{ id, box }]
  })
}

function insideOf(slide: CanvasSlide | null, node: ElementId | null): ElementId | null {
  const found = slide?.elements.find((each) => each.id === node)
  return found?.parent ?? found?.group?.id ?? null
}

function layerSelection(slide: CanvasSlide | null, nodes: readonly ElementId[]): Selection {
  const insides = nodes.map((node) => insideOf(slide, node))
  const [first = null] = insides
  return insides.every((inside) => inside === first)
    ? { ids: nodes, inside: first }
    : { ids: nodes, inside: null, acrossGroups: true }
}

function useTypedNames(store: PaintStore, nodes: readonly ElementId[]): ReadonlyMap<ElementId, string> {
  const [version, typed] = useReducer((count: number) => count + 1, 0)
  const key = nodes.join(" ")
  useEffect(() => {
    const stops = nodes.map((node) => store.elementSubscribe(node)(typed))
    return () => {
      for (const stop of stops) stop()
    }
  }, [store, key])
  return useMemo(() => {
    const names = new Map<ElementId, string>()
    for (const node of nodes) {
      const text = store.getElement(node)?.text
      if (text !== undefined) names.set(node, textLayerName(text))
    }
    return names
  }, [store, key, version])
}

function useSlideTree(deck: LayeringDeck): readonly Layer[] {
  const { shown } = deck
  const file = shown.shownParts.current
  const parts = shown.displayParts.current
  const register = shown.shownRegister.current
  const slide = shown.store.current.slides()[shown.current]?.id
  const textNamed = useMemo(
    () => (register === null ? [] : [...textNamedNow(register)].filter((node) => shapeOf(node).slide === slide)),
    [register, slide],
  )
  const typed = useTypedNames(shown.store.current, textNamed)
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
      const name = typed.get(node)
      return {
        kind,
        ...(name === undefined ? {} : { name }),
        ...(view.backdrop === undefined ? {} : { backdrop: view.backdrop }),
        ...(flow === undefined || flow === "none" ? {} : { flow }),
      }
    }
    return layerTree(slideLayerRows(parts, slide, look))
  }, [file, parts, register, slide, typed])
}

export function LiveLayers({
  deck,
  onHover,
  rename,
  onRenameStarted,
}: {
  readonly deck: LayeringDeck
  readonly onHover: (node: ElementId | null) => void
  readonly rename?: RenameRequest | null
  readonly onRenameStarted?: () => void
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
        ...(rename === undefined ? {} : { rename }),
        ...(onRenameStarted === undefined ? {} : { onRenameStarted }),
        onSelect: select,
        onHover,
        onRename: (node, name) => changeDesign(deck, () => ({ target: { node }, identity: { name } })),
        onOrder: (node, before) => void deck.changeElement({ change: "order", node, move: { before } }),
        onMove: (node, parent, before, from) =>
          void deck.changeElement({ change: "join", node, parent, before, from }).then((outcome) => {
            if (!["refused", "closed", "too-large"].includes(outcome)) deck.select({ ids: [node], inside: parent })
          }),
        joins: (node, parent) => {
          const register = deck.shown.shownRegister.current
          return register !== null && layerJoins(deck.shown.shownParts.current, register, node, parent)
        },
        onStack: (node, move) => void deck.changeElement({ change: "order", node, move }),
        onFrame: (nodes) => void deck.changeElement({ change: "plain-frame", nodes }),
        onDuplicate: (nodes) => {
          const inside = insideOf(canvas, nodes[0] ?? null)
          void deck.duplicateLayers?.(copiesOf(deck, canvas, nodes)).then((made) => {
            if (made.length > 0) deck.select({ ids: made.map((each) => each.copy), inside })
          })
        },
        onFlag: (nodes, flag, on) => setLayerFlag(deck, nodes, flag, on),
      }}
    />
  )
}
