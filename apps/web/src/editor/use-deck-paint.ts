import { type ElementId, type Register } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { boundTargets, type ReadShape } from "@airdesign/pptx"
import { paintStore, type Entering } from "@airdesign/render"
import { useRef, useState } from "react"
import { type SlideCanvases } from "@/canvas-slide"
import type { StripSection } from "@/editor/slide-sidebar"
import { type TextBox } from "@/commit-edit"
import { paint, withFileFloors, type Painted } from "@/deck-paint"
import { busyElements, liveRepaint } from "@/live-repaint"
import { notesShown, type ShownNotes } from "@/notes-edit"
import { type PictureSources } from "@/picture-fill"
import { type PictureStore } from "@/picture-tool"
import { layoutChoices } from "@/slide-layout"
import { structureOf } from "@/table-hook"

export type DeckPaint = ReturnType<typeof useDeckPaint>

export function useDeckPaint(
  id: string,
  pictureTool: { readonly store: PictureStore },
  notesBar: { readonly show: (notes: readonly ShownNotes[]) => void },
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
  const busy = useRef(busyElements())
  const structure = useRef("")
  const bound = useRef<ReadonlySet<string>>(new Set())
  const shownRegister = useRef<Register | null>(null)
  const repaint = useRef<(register: Register, from?: "person") => void>(() => undefined)
  const [entering, setEntering] = useState<Entering | null>(null)
  const [slideCount, setSlideCount] = useState(0)
  const [layouts, setLayouts] = useState<ReturnType<typeof layoutChoices>>([])
  const [sections, setSections] = useState<readonly StripSection[]>([])
  const [current, setCurrent] = useState(0)
  const saySlide = useRef<(text: string) => void>(() => undefined)

  function showOpened(parts: ReadonlyMap<string, Uint8Array>, register: Register | null) {
    shownParts.current = parts
    setLayouts(layoutChoices(parts))
    showRegister(register, "whole")
    setCurrent(0)
  }

  function showRegister(register: Register | null, whole?: "whole") {
    const before = whole === "whole" ? null : painted.current
    const framed = register === null ? null : withFileFloors(register, shownParts.current)
    const next = paint(store.current, shownParts.current, framed, busy.current, pictureTool.store.bytes, before)
    painted.current = next
    boxes.current = next.boxes
    movables.current = next.movables
    shapes.current = next.shapes
    editParts.current = next.base
    displayParts.current = next.display
    canvases.current = next.canvases
    pictures.current?.release()
    pictures.current = next.pictures
    bound.current = boundTargets(next.display)
    structure.current = structureOf(framed, bound.current)
    shownRegister.current = register
    const paintChanges = liveRepaint(store.current, next.files, framed, busy.current, next.numberText)
    repaint.current = (changed, from) => {
      shownRegister.current = changed
      paintChanges(changed, from)
    }
    notesBar.show(notesShown(shownParts.current, register))
    setSlideCount(next.count)
    setSections(next.sections)
    void pictureTool.store.load(id, register).then((more) => {
      if (more && structure.current === structureOf(framed, bound.current)) showRegister(shownRegister.current)
    })
  }

  async function showEdited(currentIndex: number, whole?: "whole") {
    const next = await connect(memoryRemote()).openDeck(id)
    if (!next.ok) return
    showRegister(next.register, whole)
    setCurrent(Math.max(0, Math.min(currentIndex, store.current.slides().length - 1)))
  }

  return {
    store,
    boxes,
    movables,
    shapes,
    shownParts,
    shownRegister,
    editParts,
    displayParts,
    canvases,
    pictures,
    busy,
    structure,
    bound,
    repaint,
    entering,
    setEntering,
    slideCount,
    layouts,
    sections,
    current,
    setCurrent,
    showOpened,
    showRegister,
    showEdited,
    saySlide,
  }
}
