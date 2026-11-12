import { deckRoutes } from "@airdesign/catalog"
import {
  readElementId,
  slideId,
  writeTextValue,
  type Box,
  type ElementId,
  type Register,
  type TextValue,
} from "@airdesign/document"
import { connect, fetchOriginal, getParts, memoryRemote, putParts } from "@airdesign/live"
import {
  applyRoute,
  exportPackage,
  paintReader,
  paintKind,
  readPackage,
  readShapes,
  readSlides,
  type ReadShape,
} from "@airdesign/pptx"
import { paintStore, SlideCanvas, textValue, type PaintStore } from "@airdesign/render"
import { useCallback, useEffect, useRef, useState } from "react"
import { slideCanvases, type SlideCanvases } from "@/canvas-slide"
import { signInAddress, ThinNoticeView, type ThinNotice } from "@/thin-notice"
import { exportFileName } from "@/export/export-file-name"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { slideThumbWidth } from "@/editor/slide-sidebar"
import { slideFrame } from "@/editor/revenue-slide"
import { cn } from "@/lib/class-names"
import { commitBox, commitEdit, flushPending, server, type CommitOutcome, type TextBox } from "@/commit-edit"
import { boxStorable, landedBox } from "@/element-move"
import { exportedParts } from "@/exported-parts"
import { ensureMarkup } from "@/markup"
import { backfillIndex } from "@/index-deck"
import { pictureSources, type PictureSources } from "@/picture-fill"
import { followDeck } from "@/deck-follow"
import { busyElements, liveRepaint, shownValue } from "@/live-repaint"

type NamedShape = { readonly id: ElementId; readonly shape: ReadShape }

function namedShapes(parts: ReadonlyMap<string, Uint8Array>): readonly NamedShape[] {
  const named: NamedShape[] = []
  for (const shape of readShapes(parts)) {
    const id = readElementId(`${shape.slide}.${shape.shape}`)
    if (id !== undefined) named.push({ id, shape })
  }
  return named
}

export function elementIds(parts: ReadonlyMap<string, Uint8Array>): readonly ElementId[] {
  return namedShapes(parts).map((named) => named.id)
}

function thumbHeight(slide: { readonly width: number; readonly height: number } | null): number {
  if (slide === null || slide.width === 0) return Math.round((slideThumbWidth * 9) / 16)
  return Math.round((slideThumbWidth * slide.height) / slide.width)
}

function storedText(value: TextValue): string {
  return value.length === 0 ? "" : writeTextValue(value)
}

function trialValue(value: TextValue): TextValue | null {
  for (let paragraph = value.length - 1; paragraph >= 0; paragraph -= 1) {
    const runs = value[paragraph]?.runs ?? []
    for (let run = runs.length - 1; run >= 0; run -= 1) {
      const found = runs[run]
      if (found === undefined || found.text === "\n") continue
      return value.map((each, index) =>
        index === paragraph
          ? {
              from: each.from,
              runs: runs.map((kept, at) => (at === run ? { ...kept, text: `${kept.text}.` } : kept)),
            }
          : each,
      )
    }
  }
  const first = value[0]
  if (first === undefined) return null
  return [{ from: first.from, runs: [...first.runs, { from: -1, text: "." }] }, ...value.slice(1)]
}

export function valueStorable(
  parts: ReadonlyMap<string, Uint8Array>,
  shape: ReadShape,
  value: TextValue | null,
): boolean {
  if (value === null) return false
  try {
    applyRoute(parts, {
      name: "text",
      part: shape.part,
      shape: shape.shape,
      value,
    })
    return true
  } catch {
    return false
  }
}

function paint(
  store: PaintStore,
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
): {
  readonly count: number
  readonly canvases: SlideCanvases
  readonly boxes: ReadonlyMap<ElementId, TextBox>
  readonly movables: ReadonlyMap<ElementId, TextBox>
  readonly shapes: ReadonlyMap<ElementId, ReadShape>
  readonly pictures: PictureSources
  readonly files: ReadonlyMap<ElementId, string>
} {
  const named = namedShapes(parts)
  const ids = named.map((each) => each.id)
  const seen = new Map<ElementId, number>()
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1)
  const boxes = new Map<ElementId, TextBox>()
  const movables = new Map<ElementId, TextBox>()
  const rows = new Map<ElementId, ReadShape>()
  const files = new Map<ElementId, string>()
  for (const { id, shape } of named) {
    const kind = paintKind(shape.kind)
    const file = storedText(shape.text)
    files.set(id, file)
    store.publish({ id, kind, text: shownValue(register, id, file), picture: kind === "picture" ? "" : null })
    store.placeBox(id, landedBox(register, id))
    if (seen.get(id) === 1 && boxStorable(parts, shape)) movables.set(id, { id, file })
    const storable = seen.get(id) === 1 && !shape.locked && valueStorable(parts, shape, trialValue(shape.text))
    if (!storable) continue
    boxes.set(id, { id, file })
    rows.set(id, shape)
  }
  const read = readSlides(parts).map(({ slide, part }) => ({
    slide,
    part,
    named: named.filter((each) => each.shape.slide === slide),
  }))
  store.setSlides(read.map((each) => ({ id: slideId(each.slide), elements: each.named.map((shape) => shape.id) })))
  const sources = read.map((each) => ({
    part: each.part,
    shapes: new Map(
      each.named.map(({ id, shape }) => [
        shape.shape,
        { id, kind: paintKind(shape.kind), editable: boxes.has(id), movable: movables.has(id) },
      ]),
    ),
  }))
  const pictures = pictureSources(parts)
  const canvases = slideCanvases(paintReader(parts), sources, pictures.src)
  return { count: read.length, canvases, boxes, movables, shapes: rows, pictures, files }
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
  const canvases = useRef<SlideCanvases>(() => null)
  const pictures = useRef<PictureSources | null>(null)
  const busy = useRef(busyElements())
  const [slideCount, setSlideCount] = useState(0)
  const [current, setCurrent] = useState(0)
  const [title, setTitle] = useState("")
  const [paintedDeck, setPaintedDeck] = useState<string | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const [failure, setFailure] = useState<"import-failed" | "export-failed" | null>(null)

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
      const painted = paint(store.current, stored.parts, register)
      const repaint = liveRepaint(store.current, painted.files, register, busy.current)
      boxes.current = painted.boxes
      movables.current = painted.movables
      shapes.current = painted.shapes
      shownParts.current = stored.parts
      canvases.current = painted.canvases
      pictures.current?.release()
      pictures.current = painted.pictures
      setSlideCount(painted.count)
      setCurrent(0)
      setTitle(stored.name ?? "")
      setPaintedDeck(id)
      await backfillIndex(id, stored.parts)
      settle(await flushPending(connect, id))
      await followDeck(
        connect(server),
        id,
        async () => {
          const next = await connect(server).openDeck(id)
          if (live && next.ok) repaint(next.register)
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
    }
    window.addEventListener("offline", leftNetwork)
    window.addEventListener("online", returnedToNetwork)
    return () => {
      window.removeEventListener("offline", leftNetwork)
      window.removeEventListener("online", returnedToNetwork)
    }
  }, [id, settle])

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

  async function onEdit(target: ElementId, value: string) {
    const box = boxes.current.get(target)
    if (box === undefined) return
    const file = box.file
    async function refused() {
      const opened = await connect(memoryRemote()).openDeck(id)
      show(target, shownValue(opened.ok ? opened.register : null, target, file))
    }
    const shape = shapes.current.get(target)
    if (shape === undefined || !valueStorable(shownParts.current, shape, textValue(value))) {
      await refused()
      return
    }
    const outcome = await commitEdit(
      connect,
      id,
      value,
      box,
      () => {
        setPending(true)
        show(target, value)
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
    const outcome = await commitBox(
      connect,
      id,
      box,
      element,
      () => {
        setPending(true)
        store.current.placeBox(target, box)
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

  const notice: ThinNotice | null = failure ?? (offline && pending ? "offline" : null)

  return (
    <div className="thin-page" data-deck-ready={paintedDeck}>
      <ThinNoticeView notice={notice} onTryAgain={tryAgain} />
      <EditorFrame>
        <EditorShell
          deck={{
            onExport: () => void onExport(),
            size: canvases.current(current),
            slides: {
              count: slideCount,
              current,
              onSelect: setCurrent,
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
          slideLabel={String(current + 1)}
          title={title}
        />
      </EditorFrame>
    </div>
  )
}
