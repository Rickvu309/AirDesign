import {
  currentValue,
  readElementId,
  slideId,
  version,
  writeTextValue,
  type ElementId,
  type Kind,
  type Register,
  type TextValue,
} from "@airdesign/document"
import { connect, getParts, httpRemote, memoryRemote, putParts, type Remote } from "@airdesign/live"
import {
  applyRoute,
  exportPackage,
  prepareMarkup,
  readPackage,
  readShapes,
  readSlides,
  type ReadShape,
  type ShapeKind,
} from "@airdesign/pptx"
import { Passage, paintStore, textValue, type PaintStore } from "@airdesign/render"
import { useCallback, useEffect, useRef, useState } from "react"
import { signInAddress, ThinNoticeView, type ThinNotice } from "@/thin-notice"
import wasmUrl from "sax-wasm/lib/sax-wasm.wasm?url"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"

export type TextBox = { readonly id: ElementId; readonly file: string }

let markup: Promise<void> | null = null

function ensureMarkup(): Promise<void> {
  if (markup === null) {
    markup = fetch(wasmUrl)
      .then(async (response) => {
        await prepareMarkup(new Uint8Array(await response.arrayBuffer()))
      })
      .catch((error: unknown) => {
        markup = null
        throw error
      })
  }
  return markup
}

function paintKind(kind: ShapeKind): Kind {
  if (kind === "p:pic") return "picture"
  if (kind === "p:cxnSp") return "connector"
  if (kind === "p:grpSp") return "group"
  if (kind === "p:graphicFrame") return "chart"
  return "shape"
}

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

export function deckName(fileName: string): string {
  return fileName.replace(/\.pptx$/i, "")
}

function paint(
  store: PaintStore,
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
): {
  readonly slides: readonly (readonly ElementId[])[]
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
  const slides = readSlides(parts).map(({ slide }) => ({
    id: slideId(slide),
    elements: named.filter((each) => each.shape.slide === slide).map((each) => each.id),
  }))
  store.setSlides(slides)
  return { slides: slides.map((each) => each.elements), boxes, shapes: rows }
}

type EditLink = {
  enqueue(deck: string, value: string, node: ElementId, floor: string): Promise<{ readonly ok: boolean }>
  flush(deck: string): Promise<unknown>
}

const server = httpRemote()

export type FlushOutcome = "sent" | "offline" | "signed-out" | "kept"

export type CommitOutcome = FlushOutcome | "refused"

export async function flushPending(open: (remote: Remote) => EditLink, deckId: string): Promise<FlushOutcome> {
  try {
    const flushed = await open(server).flush(deckId)
    if (typeof flushed !== "object" || flushed === null) return "kept"
    if ("ok" in flushed && flushed.ok === true) return "sent"
    if ("refusal" in flushed && flushed.refusal === "session") return "signed-out"
    return "kept"
  } catch (error) {
    return error instanceof TypeError ? "offline" : "kept"
  }
}

export async function commitEdit(
  open: (remote: Remote) => EditLink,
  deckId: string,
  value: string,
  box: TextBox,
  paint?: () => void,
  refused?: () => Promise<void> | void,
): Promise<CommitOutcome> {
  const result = await open(memoryRemote()).enqueue(deckId, value, box.id, box.file)
  if (!result.ok) {
    await refused?.()
    return "refused"
  }
  paint?.()
  return flushPending(open, deckId)
}

export function exportedParts(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
): ReadonlyMap<string, Uint8Array> {
  const shapes = readShapes(parts)
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const id of register.nodes) {
    const body = register.elements[id]
    if (body === undefined || version(body) === 0) continue
    const named = shapes.filter((shape) => `${shape.slide}.${shape.shape}` === id)
    const shape = named[0]
    if (named.length !== 1 || shape === undefined || shape.locked) throw new Error("text-shape")
    next = applyRoute(next, {
      name: "text",
      part: shape.part,
      shape: shape.shape,
      value: textValue(currentValue(body)),
    })
  }
  return next
}

export async function saveDeck(
  parts: ReadonlyMap<string, Uint8Array>,
  file: Uint8Array,
  name?: string,
): Promise<string | null> {
  const deckId = crypto.randomUUID()
  const saved = await putParts(deckId, { parts, file, ...(name === undefined ? {} : { name }) })
  return saved.ok ? deckId : null
}

export function ThinDeck({ id }: { id?: string }) {
  const store = useRef(paintStore())
  const boxes = useRef<ReadonlyMap<ElementId, TextBox>>(new Map())
  const shapes = useRef<ReadonlyMap<ElementId, ReadShape>>(new Map())
  const shownParts = useRef<ReadonlyMap<string, Uint8Array>>(new Map())
  const [deckId, setDeckId] = useState(id)
  const [slides, setSlides] = useState<readonly (readonly ElementId[])[]>([])
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
      const stored = await getParts(id)
      if (!stored.ok || !live) return
      const opened = await connect(server)
        .openDeck(id)
        .catch(() => null)
      if (!live) return
      const painted = paint(store.current, stored.parts, opened?.ok === true ? opened.register : null)
      boxes.current = painted.boxes
      shapes.current = painted.shapes
      shownParts.current = stored.parts
      setSlides(painted.slides)
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
      await ensureMarkup()
      const bytes = new Uint8Array(await file.arrayBuffer())
      const read = await readPackage(bytes)
      if (!read.ok) {
        setFailure("import-failed")
        return
      }
      const name = deckName(file.name)
      const nextId = await saveDeck(read.parts, bytes, name)
      if (nextId === null) {
        setFailure("import-failed")
        return
      }
      window.history.replaceState(null, "", `/thin/${nextId}`)
      shownDeck.current = nextId
      setDeckId(nextId)
      setPending(false)
      setFailure(null)
      const painted = paint(store.current, read.parts, null)
      boxes.current = painted.boxes
      shapes.current = painted.shapes
      shownParts.current = read.parts
      setSlides(painted.slides)
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
          notes=""
          onExport={() => void onExport()}
          slides={{ count: slides.length, current, onSelect: setCurrent }}
          slide={
            <div>
              {(slides[current] ?? []).map((id) =>
                boxes.current.has(id) ? (
                  <Passage key={id} id={id} onEdit={(value) => void onEdit(id, value)} store={store.current} />
                ) : (
                  <Passage key={id} id={id} store={store.current} />
                ),
              )}
            </div>
          }
          slideLabel={String(current + 1)}
          title={title}
        />
      </EditorFrame>
    </div>
  )
}
