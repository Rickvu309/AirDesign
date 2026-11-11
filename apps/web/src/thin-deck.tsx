import { deckRoutes } from "@airdesign/catalog"
import {
  currentValue,
  readElementId,
  slideId,
  writeTextValue,
  type ElementId,
  type Register,
  type TextValue,
} from "@airdesign/document"
import { connect, fetchOriginal, getParts, memoryRemote, putParts, sendOriginal } from "@airdesign/live"
import {
  applyRoute,
  exportPackage,
  paintReader,
  readPackage,
  readShapes,
  readSlides,
  type ReadShape,
} from "@airdesign/pptx"
import { paintStore, SlideCanvas, textValue, type PaintStore } from "@airdesign/render"
import { useCallback, useEffect, useRef, useState } from "react"
import { paintKind, slideCanvases, type SlideCanvases } from "@/canvas-slide"
import { signInAddress, ThinNoticeView, type ThinNotice } from "@/thin-notice"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { slideFrame } from "@/editor/revenue-slide"
import { cn } from "@/lib/class-names"
import { commitEdit, flushPending, server, type CommitOutcome, type TextBox } from "@/commit-edit"
import { exportedParts } from "@/exported-parts"
import { importDeck, nameImportedDeck } from "@/import-deck"
import { ensureMarkup } from "@/markup"

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

export function shownValue(register: Register | null, id: ElementId, file: string): string {
  const body = register?.elements[id]
  return body === undefined ? file : currentValue(body)
}

function paint(
  store: PaintStore,
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
): {
  readonly count: number
  readonly canvases: SlideCanvases
  readonly boxes: ReadonlyMap<ElementId, TextBox>
  readonly shapes: ReadonlyMap<ElementId, ReadShape>
} {
  const named = namedShapes(parts)
  const ids = named.map((each) => each.id)
  const seen = new Map<ElementId, number>()
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1)
  const boxes = new Map<ElementId, TextBox>()
  const rows = new Map<ElementId, ReadShape>()
  for (const { id, shape } of named) {
    const kind = paintKind(shape.kind)
    const file = storedText(shape.text)
    store.publish({ id, kind, text: shownValue(register, id, file), picture: kind === "picture" ? "" : null })
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
      each.named.map(({ id, shape }) => [shape.shape, { id, kind: paintKind(shape.kind), editable: boxes.has(id) }]),
    ),
  }))
  return { count: read.length, canvases: slideCanvases(paintReader(parts), sources), boxes, shapes: rows }
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

export function ThinDeck({ id, route = "thin" }: { id?: string; route?: "thin" | "deck" }) {
  const store = useRef(paintStore())
  const boxes = useRef<ReadonlyMap<ElementId, TextBox>>(new Map())
  const shapes = useRef<ReadonlyMap<ElementId, ReadShape>>(new Map())
  const shownParts = useRef<ReadonlyMap<string, Uint8Array>>(new Map())
  const [deckId, setDeckId] = useState(id)
  const canvases = useRef<SlideCanvases>(() => null)
  const [slideCount, setSlideCount] = useState(0)
  const [current, setCurrent] = useState(0)
  const [title, setTitle] = useState("")
  const [paintedDeck, setPaintedDeck] = useState<string | undefined>(undefined)
  const shownDeck = useRef(id)
  const [pending, setPending] = useState(false)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const [failure, setFailure] = useState<"import-failed" | "export-failed" | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const settle = useCallback((outcome: CommitOutcome) => {
    if (outcome === "sent") setPending(false)
    if (outcome === "offline") setPending(true)
    if (outcome !== "refused") setOffline(outcome === "offline")
    if (outcome === "signed-out") window.location.assign(signInAddress(window.location))
  }, [])

  useEffect(() => {
    if (id === undefined) return
    let live = true
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
      const painted = paint(store.current, stored.parts, opened?.ok === true ? opened.register : null)
      boxes.current = painted.boxes
      shapes.current = painted.shapes
      shownParts.current = stored.parts
      canvases.current = painted.canvases
      setSlideCount(painted.count)
      setCurrent(0)
      setTitle(stored.name ?? "")
      setPaintedDeck(id)
      settle(await flushPending(connect, id))
    })()
    return () => {
      live = false
    }
  }, [id, settle])

  useEffect(() => {
    function leftNetwork() {
      setOffline(true)
    }
    async function returnedToNetwork() {
      const deck = shownDeck.current
      if (deck !== undefined) settle(await flushPending(connect, deck))
    }
    window.addEventListener("offline", leftNetwork)
    window.addEventListener("online", returnedToNetwork)
    return () => {
      window.removeEventListener("offline", leftNetwork)
      window.removeEventListener("online", returnedToNetwork)
    }
  }, [settle])

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

  async function openFile(file: File) {
    setPaintedDeck(undefined)
    try {
      const imported = await importDeck(file)
      if (imported === null) {
        setFailure("import-failed")
        return
      }
      const { id: nextId, name, parts } = imported
      window.history.replaceState(null, "", `/${route}/${nextId}`)
      void nameImportedDeck(imported).then(() => sendOriginal(nextId, imported.file))
      shownDeck.current = nextId
      setDeckId(nextId)
      setPending(false)
      setFailure(null)
      const painted = paint(store.current, parts, null)
      boxes.current = painted.boxes
      shapes.current = painted.shapes
      shownParts.current = parts
      canvases.current = painted.canvases
      setSlideCount(painted.count)
      setCurrent(0)
      setTitle(name)
      setPaintedDeck(nextId)
    } catch {
      setFailure("import-failed")
    }
  }

  async function onEdit(target: ElementId, value: string) {
    const box = boxes.current.get(target)
    if (box === undefined || deckId === undefined) return
    const deck = deckId
    const file = box.file
    async function refused() {
      const opened = await connect(memoryRemote()).openDeck(deck)
      show(target, shownValue(opened.ok ? opened.register : null, target, file))
    }
    const shape = shapes.current.get(target)
    if (shape === undefined || !valueStorable(shownParts.current, shape, textValue(value))) {
      await refused()
      return
    }
    const outcome = await commitEdit(
      connect,
      deck,
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

  async function exportDeck(id: string) {
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
    link.download = "exported-deck.pptx"
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function onExport() {
    if (deckId === undefined) return
    try {
      await exportDeck(deckId)
      setFailure(null)
    } catch {
      setFailure("export-failed")
    }
  }

  function tryAgain(notice: ThinNotice) {
    if (notice === "import-failed") picker.current?.click()
    if (notice === "export-failed") void onExport()
  }

  const notice: ThinNotice | null = failure ?? (offline && pending ? "offline" : null)

  return (
    <div className="thin-page" data-deck-ready={paintedDeck}>
      <ThinNoticeView notice={notice} onTryAgain={tryAgain} />
      <EditorFrame
        top={
          <div className="flex items-center gap-4 px-4 py-2">
            <input
              ref={picker}
              accept=".pptx"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file === undefined) return
                void openFile(file)
              }}
            />
          </div>
        }
      >
        <EditorShell
          panel="none"
          onExport={() => void onExport()}
          slides={{ count: slideCount, current, onSelect: setCurrent }}
          slide={(width) => {
            const canvas = canvases.current(current)
            return canvas === null ? (
              <div />
            ) : (
              <SlideCanvas
                className={cn(slideFrame, "shrink-0 overflow-clip focus-within:overflow-visible")}
                onEdit={(target, value) => void onEdit(target, value)}
                slide={canvas}
                store={store.current}
                width={width}
              />
            )
          }}
          slideLabel={String(current + 1)}
          title={title}
        />
      </EditorFrame>
    </div>
  )
}
