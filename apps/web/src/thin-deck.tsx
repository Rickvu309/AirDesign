import { elementId, type Box, type ElementId, type Register, type Undoable } from "@airdesign/document"
import { connect, distrustDevice, flushOriginal, memoryRemote, trustDeck } from "@airdesign/live"
import { readNotes, type ReadShape, type SectionStart, type SlideNotes } from "@airdesign/pptx"
import { paintStore, SlideCanvas, textValue } from "@airdesign/render"
import { toast } from "sonner"
import { useCallback, useEffect, useRef, useState } from "react"
import { type SlideCanvases } from "@/canvas-slide"
import { signInAddress, ThinNoticeView, type ThinNotice } from "@/thin-notice"
import { downloadDeck } from "@/deck-download"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { thumbHeight } from "@/thumb-height"
import { slideFrame } from "@/editor/revenue-slide"
import { cn } from "@/lib/class-names"
import {
  commitBox,
  commitEdit,
  commitKept,
  flushPending,
  server,
  type CommitOutcome,
  type TextBox,
} from "@/commit-edit"
import { boxName, landedBox, paintedBox, shownBox } from "@/element-move"
import { exportedParts } from "@/exported-parts"
import { commitSlideChange, slideNames, type SlideChange } from "@/slide-edit"
import { layoutChoices } from "@/slide-layout"
import { commitElement, type ElementChange } from "@/element-edit"
import { ensureMarkup } from "@/markup"
import { backfillIndex } from "@/index-deck"
import { type PictureSources } from "@/picture-fill"
import { paint, valueStorable } from "@/deck-paint"
export { elementIds, valueStorable } from "@/deck-paint"
import { followDeck } from "@/deck-follow"
import { closesDeck, deckParts, deviceCopy } from "@/device-copy"
import { busyElements, liveRepaint, shownValue } from "@/live-repaint"
import { AiraPanel } from "@/aira-panel"
import { useUndoKeys } from "@/editor/undo-keys"
import { emptyUndo, recorded, turnBack, undoLabel, type UndoDirection, type UndoEntry } from "@/undo-list"

export function ThinDeck({ id }: { id: string }) {
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
  const [entering, setEntering] = useState<ElementId | null>(null)
  const [notes, setNotes] = useState<readonly SlideNotes[]>([])
  const notesQueue = useRef(Promise.resolve())
  const [slideCount, setSlideCount] = useState(0)
  const [layouts, setLayouts] = useState<ReturnType<typeof layoutChoices>>([])
  const [sections, setSections] = useState<readonly SectionStart[]>([])
  const [current, setCurrent] = useState(0)
  const [title, setTitle] = useState("")
  const [paintedDeck, setPaintedDeck] = useState<string | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const [failure, setFailure] = useState<"import-failed" | "export-failed" | null>(null)
  const [refused, setRefused] = useState(false)
  const [panel, setPanel] = useState<"agent" | "design">("agent")
  const undoList = useRef(emptyUndo)
  const turning = useRef<Promise<void>>(Promise.resolve())
  const [undoShown, setUndoShown] = useState(emptyUndo)
  const [told, setTold] = useState<UndoDirection | null>(null)
  const typed = useRef<{ readonly node: ElementId; readonly session: number; readonly before: Promise<string> } | null>(
    null,
  )
  const sessions = useRef(0)

  const settle = useCallback((outcome: CommitOutcome) => {
    if (outcome === "sent") setPending(false)
    if (outcome === "offline") setPending(true)
    if (outcome !== "refused") setOffline(outcome === "offline")
    if (outcome === "signed-out")
      void distrustDevice().then(() => window.location.assign(signInAddress(window.location)))
  }, [])

  useEffect(() => {
    let live = true
    const leaving = new AbortController()
    setPaintedDeck(undefined)
    setRefused(false)
    void (async () => {
      await ensureMarkup()
      const device = await deviceCopy(id)
      if (!live) return
      if (device !== null) openFrom(device.stored, device.register)
      const stored = device?.stored ?? (await deckParts(id))
      if (!live) return
      if (stored === "signed-out") {
        window.location.assign(signInAddress(window.location))
        return
      }
      if (stored === null) {
        setFailure("import-failed")
        return
      }
      const answered = await connect(server)
        .open(id)
        .catch(() => null)
      if (!live) return
      if (answered !== null && !answered.ok && (await refusedBy(answered.refusal))) return
      if (answered?.ok === true) await trustDeck(id)
      const opened = await connect(server)
        .openDeck(id)
        .catch(() => null)
      if (!live) return
      const register = opened?.ok === true ? opened.register : null
      if (device === null) openFrom(stored, register)
      else if (register !== null) reconcile(register)
      if (register?.index === undefined || register.index.elements.length !== register.index.total)
        await backfillIndex(id, stored.parts)
      settle(await flushPending(connect, id))
      await flushOriginal(id)
      const ended = await followDeck(
        connect(server),
        id,
        async () => {
          const next = await connect(server).openDeck(id)
          if (live && next.ok) reconcile(next.register)
        },
        leaving.signal,
      )
      if (live && ended !== undefined) await refusedBy(ended)
    })()
    return () => {
      live = false
      leaving.abort()
    }
  }, [id, settle])

  useEffect(
    () => () => {
      pictures.current?.release()
      pictures.current = null
    },
    [],
  )

  useEffect(() => {
    function leftNetwork() {
      setOffline(true)
    }
    async function returnedToNetwork() {
      settle(await flushPending(connect, id))
      await flushOriginal(id)
    }
    window.addEventListener("offline", leftNetwork)
    window.addEventListener("online", returnedToNetwork)
    return () => {
      window.removeEventListener("offline", leftNetwork)
      window.removeEventListener("online", returnedToNetwork)
    }
  }, [id, settle])

  useEffect(() => {
    function closeSession() {
      typed.current = null
    }
    window.addEventListener("focusout", closeSession)
    return () => window.removeEventListener("focusout", closeSession)
  }, [])

  useEffect(() => {
    if (told === null) return
    const clear = window.setTimeout(() => setTold(null), 4000)
    return () => window.clearTimeout(clear)
  }, [told])

  function show(target: ElementId, text: string) {
    const record = store.current.getElement(target)
    if (record !== null)
      store.current.publish({
        id: record.id,
        kind: record.kind,
        text,
        picture: record.picture,
      })
  }

  async function textBefore(target: ElementId): Promise<string> {
    const file = boxes.current.get(target)?.file ?? ""
    const opened = await connect(memoryRemote()).openDeck(id)
    return shownValue(opened.ok ? opened.register : null, target, file)
  }

  async function onEdit(target: ElementId, value: string) {
    if (typed.current?.node !== target) {
      sessions.current += 1
      typed.current = { node: target, session: sessions.current, before: textBefore(target) }
    }
    const { session } = typed.current
    const started = typed.current.before
    const box = boxes.current.get(target)
    if (box === undefined) return
    const file = box.file
    async function refused() {
      const opened = await connect(memoryRemote()).openDeck(id)
      show(target, shownValue(opened.ok ? opened.register : null, target, file))
    }
    const shape = shapes.current.get(target)
    if (shape === undefined || !valueStorable(editParts.current, shape, textValue(value))) {
      await refused()
      return
    }
    const outcome = await commitEdit(
      connect,
      id,
      value,
      box,
      async () => {
        const before = await started
        setPending(true)
        show(target, value)
        record({
          name: "text",
          session,
          undoable: { node: target, floor: file, before: { value: before }, after: { value } },
        })
      },
      refused,
    )
    settle(outcome)
  }

  async function onBox(target: ElementId, box: Box) {
    async function refused() {
      const opened = await connect(memoryRemote()).openDeck(id)
      store.current.placeBox(target, landedBox(opened.ok ? opened.register : null, target))
    }
    const element = movables.current.get(target)
    if (element === undefined) {
      await refused()
      return
    }
    const opening = connect(memoryRemote()).openDeck(id)
    const outcome = await commitBox(
      connect,
      id,
      box,
      element,
      async () => {
        const opened = await opening
        const file = shapes.current.get(target)?.box ?? paintedBox(canvases.current(current), target)
        const before = shownBox(opened.ok ? opened.register : null, target, file)
        setPending(true)
        const name = before === null ? null : boxName(before, box)
        if (before === null || name === null) return
        record({
          name,
          undoable: {
            node: target,
            floor: element.file,
            before: { property: "box", value: before },
            after: { property: "box", value: box },
          },
        })
      },
      refused,
    )
    settle(outcome)
  }

  function holding(target: ElementId, work: () => Promise<void>) {
    const release = busy.current.hold(target)
    void work().finally(release)
  }

  async function exportDeck() {
    await notesQueue.current
    await downloadDeck(id)
  }

  function openFrom(
    stored: { readonly parts: ReadonlyMap<string, Uint8Array>; readonly name?: string },
    register: Register | null,
  ) {
    shownParts.current = stored.parts
    setLayouts(layoutChoices(stored.parts))
    showRegister(register)
    setCurrent(0)
    setTitle(stored.name ?? "")
    setPaintedDeck(id)
  }

  function reconcile(register: Register) {
    const before = store.current.slides().map((slide) => slide.id)
    if (structure.current !== JSON.stringify(register.order)) {
      showRegister(register)
      const after = store.current.slides().map((slide) => slide.id)
      setCurrent((index) => {
        const kept = after.findIndex((slide) => slide === before[index])
        return kept >= 0 ? kept : Math.max(0, Math.min(index, after.length - 1))
      })
    } else {
      repaint.current(register)
      setNotes(readNotes(exportedParts(shownParts.current, register)))
    }
  }

  async function refusedBy(refusal: string): Promise<boolean> {
    if (refusal === "session") {
      await distrustDevice()
      window.location.assign(signInAddress(window.location))
      return true
    }
    if (!closesDeck(refusal)) return false
    setPaintedDeck(undefined)
    setRefused(true)
    return true
  }

  function showRegister(register: Register | null) {
    const painted = paint(store.current, shownParts.current, register, busy.current)
    boxes.current = painted.boxes
    movables.current = painted.movables
    shapes.current = painted.shapes
    editParts.current = painted.base
    canvases.current = painted.canvases
    pictures.current?.release()
    pictures.current = painted.pictures
    structure.current = JSON.stringify(register?.order ?? [])
    repaint.current = liveRepaint(store.current, painted.files, register, busy.current)
    setNotes(readNotes(register === null ? shownParts.current : exportedParts(shownParts.current, register)))
    setSlideCount(painted.count)
    setSections(painted.sections)
  }

  async function showEdited(currentIndex: number) {
    const next = await connect(memoryRemote()).openDeck(id)
    if (!next.ok) return
    showRegister(next.register)
    setCurrent(Math.max(0, Math.min(currentIndex, store.current.slides().length - 1)))
    setPending(true)
  }

  async function changeSlide(change: SlideChange, index: number, to = index, layoutPart?: string) {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return
    const painted = async (currentIndex: number, undoable: Undoable | null) => {
      if (undoable !== null) record({ name: slideNames[change], undoable })
      await showEdited(currentIndex)
    }
    settle(await commitSlideChange(id, shownParts.current, opened.register, change, index, painted, to, layoutPart))
  }

  function record(entry: UndoEntry) {
    undoList.current = recorded(undoList.current, entry)
    setUndoShown(undoList.current)
    setTold(null)
  }

  async function showTurned(undoable: Undoable) {
    const next = await connect(memoryRemote()).openDeck(id)
    if (!next.ok) return
    if ("slide" in undoable) showRegister(next.register)
    else repaint.current(next.register, "person")
    if ("node" in undoable && undoable.node.endsWith(".notes"))
      setNotes(readNotes(exportedParts(shownParts.current, next.register)))
    else if ("node" in undoable) {
      show(undoable.node, shownValue(next.register, undoable.node, boxes.current.get(undoable.node)?.file ?? ""))
      store.current.placeBox(undoable.node, landedBox(next.register, undoable.node))
    }
    const slides = store.current.slides()
    const shown =
      "slide" in undoable
        ? slides.findIndex((slide) => slide.id === undoable.slide)
        : slides.findIndex((slide) => undoable.node.startsWith(`${slide.id}.`))
    setCurrent((index) => (shown >= 0 ? shown : Math.max(0, Math.min(index, slides.length - 1))))
    setPending(true)
  }

  function turn(direction: UndoDirection) {
    typed.current = null
    turning.current = turning.current.then(async () => {
      await notesQueue.current
      const turned = await turnBack(connect(memoryRemote()), id, undoList.current, direction)
      if (turned.outcome === "empty") return
      undoList.current = turned.list
      setUndoShown(turned.list)
      setTold(turned.outcome === "changed" ? direction : null)
      if (turned.outcome === "changed") return
      await showTurned(turned.entry.undoable)
      settle(await flushPending(connect, id))
    })
  }

  useUndoKeys(paintedDeck === id, turn)

  async function changeElement(change: ElementChange) {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return
    settle(
      await commitElement(id, shownParts.current, opened.register, change, async (added, undoable) => {
        if (undoable !== null) record({ name: added === null ? "delete-element" : "add-box", undoable })
        await showEdited(current)
        setEntering(added)
      }),
    )
  }

  function addText() {
    const size = canvases.current(current)
    if (size !== null) void changeElement({ change: "text", index: current, size })
  }

  async function onExport() {
    try {
      await exportDeck()
      setFailure(null)
    } catch {
      setFailure("export-failed")
    }
  }

  function tryAgain(notice: ThinNotice) {
    if (notice === "import-failed") window.location.assign("/")
    if (notice === "export-failed") void onExport()
  }

  const currentSlide = store.current.slides()[current]?.id
  const currentNotes = notes.find((notes) => notes.slide === currentSlide)

  function editNotes(value: string) {
    if (currentNotes === undefined) return
    const note = currentNotes
    const node = elementId(`${note.slide}.notes`)
    if (typed.current?.node !== node) {
      sessions.current += 1
      typed.current = { node, session: sessions.current, before: Promise.resolve(note.text) }
    }
    const { session, before } = typed.current
    const kept = connect(memoryRemote()).enqueue(id, value, node, note.text)
    notesQueue.current = notesQueue.current.then(async () => {
      const from = await before
      const outcome = await commitKept(connect, id, kept, () => {
        setPending(true)
        setNotes((all) => all.map((each) => (each.slide === note.slide ? { ...each, text: value } : each)))
        record({ name: "notes", session, undoable: { node, floor: from, before: { value: from }, after: { value } } })
      })
      if (outcome === "refused")
        toast.error("Unable to save speaker notes", { description: "Copy your notes, reload the deck and try again." })
      settle(outcome)
    })
  }

  if (refused) {
    return (
      <div className="thin-page" data-deck-refused>
        <ThinNoticeView notice="import-failed" onTryAgain={tryAgain} />
        <EditorFrame>{null}</EditorFrame>
      </div>
    )
  }

  const toldNotice: ThinNotice | null = told === null ? null : told === "undo" ? "undo-changed" : "redo-changed"
  const notice: ThinNotice | null = failure ?? toldNotice ?? (offline && pending ? "offline" : null)

  return (
    <div className="thin-page" data-deck-ready={paintedDeck}>
      <ThinNoticeView notice={notice} onTryAgain={tryAgain} />
      <EditorFrame>
        <EditorShell
          deck={{
            onExport: () => void onExport(),
            undo: {
              undoLabel: undoLabel("undo", undoShown),
              redoLabel: undoLabel("redo", undoShown),
              canUndo: undoShown.undo.length > 0,
              canRedo: undoShown.redo.length > 0,
              onUndo: () => turn("undo"),
              onRedo: () => turn("redo"),
            },
            onText: addText,
            size: canvases.current(current),
            slides: {
              count: slideCount,
              sections,
              current,
              onSelect: setCurrent,
              onAdd: (layoutPart) => void changeSlide("add", current, current, layoutPart),
              layouts,
              onClone: (index) => void changeSlide("clone", index),
              onRemove: (index) => void changeSlide("remove", index),
              onMove: (from, to) => void changeSlide("move", from, to),
              thumbHeight: thumbHeight(canvases.current(0)),
              thumb: (index, width) => {
                const slide = canvases.current(index)
                return slide === null ? null : <SlideCanvas quiet slide={slide} store={store.current} width={width} />
              },
            },
            slide: (width) => {
              const canvas = canvases.current(current)
              return canvas === null ? (
                <div />
              ) : (
                <SlideCanvas
                  className={cn(slideFrame, "shrink-0 overflow-clip focus-within:overflow-visible")}
                  entering={entering}
                  onBox={(target, box) => holding(target, () => onBox(target, box))}
                  onRemove={(target) => holding(target, () => changeElement({ change: "remove", node: target }))}
                  onEdit={(target, value) => holding(target, () => onEdit(target, value))}
                  slide={canvas}
                  store={store.current}
                  width={width}
                />
              )
            },
          }}
          notes={currentNotes?.text ?? ""}
          {...(currentNotes === undefined
            ? { notesLocked: "Speaker notes can't be edited on this slide yet." }
            : { onNotes: editNotes })}
          panel={panel}
          onPanel={setPanel}
          side={<AiraPanel key={id} deck={id} hidden={panel !== "agent"} />}
          slideLabel={String(current + 1)}
          title={title}
        />
      </EditorFrame>
    </div>
  )
}
