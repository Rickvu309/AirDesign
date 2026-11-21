import { type ElementId, type Register } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { boundTargets, type ReadShape } from "@airdesign/pptx"
import { paintStore, type Entering } from "@airdesign/render"
import { useRef, useState } from "react"
import { toast } from "@/components/ui/toast"
import { productCopy } from "@/copy/product-copy"
import { indexedRegister } from "@/indexed-register"
import { type SlideCanvases } from "@/canvas-slide"
import type { StripGroup } from "@/editor/slide-sidebar"
import { type TextBox } from "@/commit-edit"
import { paint, withFileFloors, type Painted } from "@/deck-paint"
import { busyElements, liveRepaint } from "@/live-repaint"
import { notesShown, type ShownNotes } from "@/notes-edit"
import { type PictureSources } from "@/picture-fill"
import { type PictureStore } from "@/picture-tool"
import { layoutChoices } from "@/slide-layout"
import { structureOf } from "@/table-hook"
import { placedOn, type PlacedText } from "@/editor/placed-text"
import { shownSlideAfter, type ShownSlide } from "@/editor/shown-slide"
import { paintingAhead } from "@/editor/painted-ahead"
import type { StoreLane } from "@/editor/store-lane"

export type DeckPaint = ReturnType<typeof useDeckPaint>

export type PartsWatch = {
  readonly subscribe: (listener: () => void) => () => void
  readonly version: () => number
  readonly changed: () => void
}

function partsWatch(): PartsWatch {
  const listeners = new Set<() => void>()
  let version = 0
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    version: () => version,
    changed() {
      version += 1
      for (const listener of Array.from(listeners)) listener()
    },
  }
}

const leftOutNotice = "edits-left-out"

export function useDeckPaint(
  id: string,
  pictureTool: { readonly store: PictureStore },
  notesBar: { readonly show: (notes: readonly ShownNotes[]) => void },
  lane: StoreLane,
) {
  const store = useRef(paintStore())
  const boxes = useRef<ReadonlyMap<ElementId, TextBox>>(new Map())
  const movables = useRef<ReadonlyMap<ElementId, TextBox>>(new Map())
  const shapes = useRef<ReadonlyMap<ElementId, ReadShape>>(new Map())
  const shownParts = useRef<ReadonlyMap<string, Uint8Array>>(new Map())
  const editParts = useRef<ReadonlyMap<string, Uint8Array>>(new Map())
  const displayParts = useRef<ReadonlyMap<string, Uint8Array>>(new Map())
  const canvases = useRef<SlideCanvases>(() => null)
  const pictures = useRef<PictureSources | null>(null)
  const painted = useRef<Painted | null>(null)
  const freed = useRef<() => void>(() => undefined)
  const busy = useRef(busyElements(() => freed.current()))
  const structure = useRef("")
  const bound = useRef<ReadonlySet<string>>(new Set())
  const shownRegister = useRef<Register | null>(null)
  const placed = useRef<readonly PlacedText[]>([])
  const showAhead = useRef<(register: Register, nodes: readonly ElementId[]) => void>(() => undefined)
  const [ahead] = useState(() =>
    paintingAhead({
      shown: () => shownRegister.current,
      keep: (register) => {
        shownRegister.current = register
      },
      show: (register, nodes) => showAhead.current(register, nodes),
    }),
  )
  const repaint = useRef<(register: Register, from?: "person", only?: ReadonlySet<ElementId>) => void>(() => undefined)
  const displayed = useRef(partsWatch())
  const [entering, setEntering] = useState<Entering | null>(null)
  const [cropping, setCropping] = useState<ElementId | null>(null)
  const [slideCount, setSlideCount] = useState(0)
  const [layouts, setLayouts] = useState<ReturnType<typeof layoutChoices>>([])
  const [groups, setSections] = useState<readonly StripGroup[]>([])
  const [current, setCurrent] = useState(0)
  const saySlide = useRef<(text: string) => void>(() => undefined)
  const noticedLeftOut = useRef(new Set<string>())

  function noticeLeftOut(leftOut: Painted["leftOut"]) {
    if (leftOut.length === 0) {
      if (noticedLeftOut.current.size > 0) toast.dismiss(leftOutNotice)
      noticedLeftOut.current.clear()
      return
    }
    const fresh = leftOut.map((command) => JSON.stringify(command)).filter((key) => !noticedLeftOut.current.has(key))
    if (fresh.length === 0) return
    for (const key of fresh) noticedLeftOut.current.add(key)
    toast.error(productCopy.editsLeftOut, { id: leftOutNotice, description: productCopy.editsLeftOutBody })
  }

  function showOpened(parts: ReadonlyMap<string, Uint8Array>, register: Register | null) {
    shownParts.current = parts
    setLayouts(layoutChoices(parts))
    showRegister(register, "whole")
    setCurrent(0)
  }

  function paintedOf(saved: Register): Register {
    return ahead.on(placedOn(saved, placed.current))
  }

  function showRegister(saved: Register | null, whole?: "whole") {
    const register = saved === null ? null : paintedOf(saved)
    const before = whole === "whole" ? null : painted.current
    const framed = register === null ? null : withFileFloors(register, shownParts.current)
    const next = paint(store.current, shownParts.current, framed, busy.current, pictureTool.store.bytes, before)
    noticeLeftOut(next.leftOut)
    painted.current = next
    boxes.current = next.boxes
    movables.current = next.movables
    shapes.current = next.shapes
    editParts.current = next.base
    if (displayParts.current !== next.display) {
      displayParts.current = next.display
      displayed.current.changed()
    }
    canvases.current = next.canvases
    pictures.current?.release()
    pictures.current = next.pictures
    bound.current = boundTargets(next.display)
    structure.current = structureOf(framed, bound.current)
    shownRegister.current = register
    const laid = framed === null ? null : indexedRegister(shownParts.current, framed)
    const paintChanges = liveRepaint(store.current, next.files, laid, busy.current, next.numberText)
    repaint.current = (changed, from, only) => {
      const register = paintedOf(changed)
      shownRegister.current = register
      paintChanges(indexedRegister(shownParts.current, register), from, only)
    }
    notesBar.show(notesShown(shownParts.current, register))
    setSlideCount(next.count)
    setSections(next.groups)
    void pictureTool.store.load(id, register, next.display).then((more) => {
      if (more && structure.current === structureOf(framed, bound.current)) showRegister(shownRegister.current)
    })
  }

  freed.current = () => void showFreed()

  function showFreed() {
    return lane(async () => {
      const next = await connect(memoryRemote()).openDeck(id)
      if (next.ok) repaint.current(next.register)
    })
  }

  showAhead.current = (register, nodes) => {
    if (structure.current === structureOf(withFileFloors(register, shownParts.current), bound.current)) {
      repaint.current(register, "person")
      return
    }
    showRegister(register)
    const missed = nodes.filter((node) => busy.current.has(node))
    if (missed.length > 0) repaint.current(register, "person", new Set(missed))
  }

  async function showEdited(wanted: ShownSlide, whole?: "whole") {
    const next = await connect(memoryRemote()).openDeck(id)
    if (!next.ok) return
    showRegister(next.register, whole)
    setCurrent((now) => shownSlideAfter(wanted, now, store.current.slides().length))
  }

  return {
    store,
    boxes,
    movables,
    shapes,
    shownParts,
    shownRegister,
    placed,
    editParts,
    displayParts,
    displayed: displayed.current,
    canvases,
    pictures,
    busy,
    structure,
    bound,
    repaint,
    entering,
    setEntering,
    cropping,
    setCropping,
    slideCount,
    layouts,
    groups,
    current,
    setCurrent,
    showOpened,
    showRegister,
    showEdited,
    ahead,
    paintedOf,
    saySlide,
  }
}
