import { deckRoutes } from "@airdesign/catalog"
import { type Box, type ElementId, type Register, type Undoable } from "@airdesign/document"
import { connect, fetchOriginal, flushOriginal, getParts, memoryRemote, putParts } from "@airdesign/live"
import { exportPackage, readPackage, type ReadShape } from "@airdesign/pptx"
import { paintStore, SlideCanvas, textValue } from "@airdesign/render"
import { useCallback, useEffect, useRef, useState } from "react"
import { type SlideCanvases } from "@/canvas-slide"
import { signInAddress, ThinNoticeView, type ThinNotice } from "@/thin-notice"
import { exportFileName } from "@/export/export-file-name"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { slideThumbWidth } from "@/editor/slide-sidebar"
import { slideFrame } from "@/editor/revenue-slide"
import { cn } from "@/lib/class-names"
import { commitBox, commitEdit, flushPending, server, type CommitOutcome, type TextBox } from "@/commit-edit"
import { landedBox, shownBox } from "@/element-move"
import { exportedParts } from "@/exported-parts"
import { commitSlideChange, type SlideChange } from "@/slide-edit"
import { ensureMarkup } from "@/markup"
import { backfillIndex } from "@/index-deck"
import { type PictureSources } from "@/picture-fill"
import { paint, valueStorable } from "@/deck-paint"
export { elementIds, valueStorable } from "@/deck-paint"
import { followDeck } from "@/deck-follow"
import { busyElements, liveRepaint, shownValue } from "@/live-repaint"
import { AiraPanel } from "@/aira-panel"
import { useUndoKeys } from "@/editor/undo-keys"
import { emptyUndo, recorded, turnBack, undoLabel, type UndoDirection, type UndoEntry } from "@/undo-list"
import type { UndoName } from "@/copy/undo-copy"

const slideNames: Readonly<Record<SlideChange, UndoName>> = {
  add: "new",
  clone: "duplicate",
  remove: "delete",
  move: "order",
}

function boxName(before: Box, after: Box): UndoName | null {
  if (before.cx !== after.cx || before.cy !== after.cy) return "resize"
  return before.x === after.x && before.y === after.y ? null : "move"
}

function thumbHeight(slide: { readonly width: number; readonly height: number } | null): number {
  if (slide === null || slide.width === 0) return Math.round((slideThumbWidth * 9) / 16)
  return Math.round((slideThumbWidth * slide.height) / slide.width)
}

async function listedName(deck: string): Promise<string | undefined> {
  try {
    const response = await fetch(deckRoutes.list.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    const listed = deckRoutes.list.result(await response.json())
    return listed.ok ? listed.decks.find((each) => each.deck === deck)?.name : undefined
  } catch {
    return undefined
  }
}

export async function deckParts(deck: string) {
  const stored = await getParts(deck)
  if (stored.ok) return stored
  const original = await fetchOriginal(deck)
  if (!original.ok) return null
  const read = await readPackage(original.file)
  if (!read.ok) return null
  const name = await listedName(deck)
  const saved = await putParts(deck, {
    parts: read.parts,
    file: original.file,
    ...(name === undefined ? {} : { name }),
  })
  return saved.ok ? saved : null
}

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
  const repaint = useRef<(register: Register) => void>(() => undefined)
  const [slideCount, setSlideCount] = useState(0)
  const [current, setCurrent] = useState(0)
  const [title, setTitle] = useState("")
  const [paintedDeck, setPaintedDeck] = useState<string | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const [failure, setFailure] = useState<"import-failed" | "export-failed" | null>(null)
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
    if (outcome === "signed-out") window.location.assign(signInAddress(window.location))
  }, [])

  useEffect(() => {
    let live = true
    const leaving = new AbortController()
    setPaintedDeck(undefined)
    void (async () => {
      await ensureMarkup()
      const stored = await deckParts(id)
      if (!live) return
      if (stored === null) {
        setFailure("import-failed")
        return
      }
      const opened = await connect(server)
        .openDeck(id)
        .catch(() => null)
      if (!live) return
      const register = opened?.ok === true ? opened.register : null
      shownParts.current = stored.parts
      showRegister(register)
      setCurrent(0)
      setTitle(stored.name ?? "")
      setPaintedDeck(id)
      await backfillIndex(id, stored.parts)
      settle(await flushPending(connect, id))
      await flushOriginal(id)
      await followDeck(
        connect(server),
        id,
        async () => {
          const next = await connect(server).openDeck(id)
          if (live && next.ok) {
            const before = store.current.slides().map((slide) => slide.id)
            if (structure.current !== JSON.stringify(next.register.order)) {
              showRegister(next.register)
              const after = store.current.slides().map((slide) => slide.id)
              setCurrent((index) => {
                const kept = after.findIndex((slide) => slide === before[index])
                return kept >= 0 ? kept : Math.max(0, Math.min(index, after.length - 1))
              })
            } else repaint.current(next.register)
          }
        },
        leaving.signal,
      )
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
    const before = await started
    const outcome = await commitEdit(
      connect,
      id,
      value,
      box,
      () => {
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
    const opened = await connect(memoryRemote()).openDeck(id)
    const before = shownBox(opened.ok ? opened.register : null, target, shapes.current.get(target)?.box ?? null)
    const outcome = await commitBox(
      connect,
      id,
      box,
      element,
      () => {
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
    await ensureMarkup()
    const stored = await getParts(id)
    if (!stored.ok) throw new Error("parts")
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) throw new Error("register")
    const bytes = await exportPackage(stored.file, exportedParts(stored.parts, opened.register))
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const url = URL.createObjectURL(new Blob([copy]))
    const link = document.createElement("a")
    link.href = url
    link.download = exportFileName(stored.name)
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
    setSlideCount(painted.count)
  }

  async function showEdited(currentIndex: number) {
    const next = await connect(memoryRemote()).openDeck(id)
    if (!next.ok) return
    showRegister(next.register)
    setCurrent(Math.max(0, Math.min(currentIndex, store.current.slides().length - 1)))
    setPending(true)
  }

  async function changeSlide(change: SlideChange, index: number, to = index) {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return
    const painted = async (currentIndex: number, undoable: Undoable | null) => {
      if (undoable !== null) record({ name: slideNames[change], undoable })
      await showEdited(currentIndex)
    }
    settle(await commitSlideChange(id, shownParts.current, opened.register, change, index, painted, to))
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
    else repaint.current(next.register)
    const slides = store.current.slides()
    const shown =
      "slide" in undoable
        ? slides.findIndex((slide) => slide.id === undoable.slide)
        : slides.findIndex((slide) => slide.elements.includes(undoable.node))
    setCurrent((index) => (shown >= 0 ? shown : Math.max(0, Math.min(index, slides.length - 1))))
    setPending(true)
  }

  function turn(direction: UndoDirection) {
    typed.current = null
    turning.current = turning.current.then(async () => {
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
            size: canvases.current(current),
            slides: {
              count: slideCount,
              current,
              onSelect: setCurrent,
              onAdd: () => void changeSlide("add", current),
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
                  onBox={(target, box) => holding(target, () => onBox(target, box))}
                  onEdit={(target, value) => holding(target, () => onEdit(target, value))}
                  slide={canvas}
                  store={store.current}
                  width={width}
                />
              )
            },
          }}
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
