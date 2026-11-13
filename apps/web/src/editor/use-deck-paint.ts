import { type ElementId, type Register } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { type ReadShape, type SectionStart } from "@airdesign/pptx"
import { paintStore, type Entering } from "@airdesign/render"
import { useRef, useState } from "react"
import { type SlideCanvases } from "@/canvas-slide"
import { type TextBox } from "@/commit-edit"
import { paint } from "@/deck-paint"
import { busyElements, liveRepaint } from "@/live-repaint"
import { notesShown, type ShownNotes } from "@/notes-edit"
import { type PictureSources } from "@/picture-fill"
import { type PictureStore } from "@/picture-tool"
import type { layoutChoices } from "@/slide-layout"
import { structureOf } from "@/table-hook"

export type DeckPaint = ReturnType<typeof useDeckPaint>

export function useDeckPaint(
  id: string,
  pictureTool: { readonly store: PictureStore },
  notesBar: { readonly show: (notes: readonly ShownNotes[]) => void },
  setPending: (pending: boolean) => void,
) {
  const store = useRef(paintStore())
  const boxes = useRef<ReadonlyMap<ElementId, TextBox>>(new Map())
  const movables = useRef<ReadonlyMap<ElementId, TextBox>>(new Map())
  const shapes = useRef<ReadonlyMap<ElementId, ReadShape>>(new Map())
  const shownParts = useRef<ReadonlyMap<string, Uint8Array>>(new Map())
  const editParts = useRef<ReadonlyMap<string, Uint8Array>>(new Map())
  const canvases = useRef<SlideCanvases>(() => null)
  const pictures = useRef<PictureSources | null>(null)
  const busy = useRef(busyElements())
  const structure = useRef("")
  const repaint = useRef<(register: Register, from?: "person") => void>(() => undefined)
  const [entering, setEntering] = useState<Entering | null>(null)
  const [slideCount, setSlideCount] = useState(0)
  const [layouts, setLayouts] = useState<ReturnType<typeof layoutChoices>>([])
  const [sections, setSections] = useState<readonly SectionStart[]>([])
  const [current, setCurrent] = useState(0)
  const saySlide = useRef<(text: string) => void>(() => undefined)

  function showRegister(register: Register | null) {
    const painted = paint(store.current, shownParts.current, register, busy.current, pictureTool.store.bytes)
    boxes.current = painted.boxes
    movables.current = painted.movables
    shapes.current = painted.shapes
    editParts.current = painted.base
    canvases.current = painted.canvases
    pictures.current?.release()
    pictures.current = painted.pictures
    structure.current = structureOf(register)
    repaint.current = liveRepaint(store.current, painted.files, register, busy.current)
    notesBar.show(notesShown(shownParts.current, register))
    setSlideCount(painted.count)
    setSections(painted.sections)
    void pictureTool.store.load(id, register).then((more) => {
      if (more && structure.current === structureOf(register)) showRegister(register)
    })
  }

  async function showEdited(currentIndex: number) {
    const next = await connect(memoryRemote()).openDeck(id)
    if (!next.ok) return
    showRegister(next.register)
    setCurrent(Math.max(0, Math.min(currentIndex, store.current.slides().length - 1)))
    setPending(true)
  }

  return {
    store,
    boxes,
    movables,
    shapes,
    shownParts,
    editParts,
    canvases,
    pictures,
    busy,
    structure,
    repaint,
    entering,
    setEntering,
    slideCount,
    layouts,
    setLayouts,
    sections,
    current,
    setCurrent,
    showRegister,
    showEdited,
    saySlide,
  }
}
