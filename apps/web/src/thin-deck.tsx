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
  type ReadShape,
  type ShapeKind,
} from "@airdesign/pptx"
import { Passage, paintStore, textValue, type PaintStore } from "@airdesign/render"
import { useEffect, useRef, useState } from "react"
import wasmUrl from "sax-wasm/lib/sax-wasm.wasm?url"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { galleryDeck } from "@/editor/gallery-deck"

export type TextBox = { readonly id: ElementId; readonly file: string }

let markup: Promise<void> | null = null

function ensureMarkup(): Promise<void> {
  if (markup === null) {
    markup = fetch(wasmUrl).then(async (response) => {
      await prepareMarkup(new Uint8Array(await response.arrayBuffer()))
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

function paint(
  store: PaintStore,
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
): {
  readonly ids: readonly ElementId[]
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
  store.setSlides([{ id: slideId("1"), elements: [...ids] }])
  return { ids, boxes, shapes: rows }
}

type EditLink = {
  enqueue(deck: string, value: string, node: ElementId, floor: string): Promise<{ readonly ok: boolean }>
  flush(deck: string): Promise<unknown>
}

export async function commitEdit(
  open: (remote: Remote) => EditLink,
  deckId: string,
  value: string,
  box: TextBox,
  paint?: () => void,
  refused?: () => Promise<void> | void,
): Promise<void> {
  const result = await open(memoryRemote()).enqueue(deckId, value, box.id, box.file)
  if (!result.ok) {
    await refused?.()
    return
  }
  paint?.()
  await sendPending(open, deckId)
}

export async function sendPending(open: (remote: Remote) => EditLink, deckId: string): Promise<void> {
  await open(httpRemote())
    .flush(deckId)
    .catch(() => undefined)
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

export async function saveDeck(parts: ReadonlyMap<string, Uint8Array>, file: Uint8Array): Promise<string | null> {
  const deckId = crypto.randomUUID()
  const saved = await putParts(deckId, { parts, file })
  return saved.ok ? deckId : null
}

export function ThinDeck({ id }: { id?: string }) {
  const store = useRef(paintStore())
  const boxes = useRef<ReadonlyMap<ElementId, TextBox>>(new Map())
  const shapes = useRef<ReadonlyMap<ElementId, ReadShape>>(new Map())
  const shownParts = useRef<ReadonlyMap<string, Uint8Array>>(new Map())
  const [deckId, setDeckId] = useState(id)
  const [ids, setIds] = useState<readonly ElementId[]>([])
  const [paintedDeck, setPaintedDeck] = useState<string | undefined>(undefined)
  const shownDeck = useRef(id)

  useEffect(() => {
    if (id === undefined) return
    let live = true
    setPaintedDeck(undefined)
    void (async () => {
      await ensureMarkup()
      const stored = await getParts(id)
      if (!stored.ok || !live) return
      const opened = await connect(memoryRemote()).openDeck(id)
      if (!live) return
      const painted = paint(store.current, stored.parts, opened.ok ? opened.register : null)
      boxes.current = painted.boxes
      shapes.current = painted.shapes
      shownParts.current = stored.parts
      setIds(painted.ids)
      setPaintedDeck(id)
      await sendPending(connect, id)
    })()
    return () => {
      live = false
    }
  }, [id])

  useEffect(() => {
    function online() {
      const deck = shownDeck.current
      if (deck !== undefined) void sendPending(connect, deck)
    }
    window.addEventListener("online", online)
    return () => {
      window.removeEventListener("online", online)
    }
  }, [])

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
    await ensureMarkup()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const read = await readPackage(bytes)
    if (!read.ok) return
    const nextId = await saveDeck(read.parts, bytes)
    if (nextId === null) return
    window.history.replaceState(null, "", `/thin/${nextId}`)
    shownDeck.current = nextId
    setDeckId(nextId)
    const painted = paint(store.current, read.parts, null)
    boxes.current = painted.boxes
    shapes.current = painted.shapes
    shownParts.current = read.parts
    setIds(painted.ids)
    setPaintedDeck(nextId)
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
    await commitEdit(connect, deck, value, box, () => show(target, value), refused)
  }

  async function onExport() {
    if (deckId === undefined) return
    await ensureMarkup()
    const stored = await getParts(deckId)
    if (!stored.ok) return
    const opened = await connect(memoryRemote()).openDeck(deckId)
    if (!opened.ok) return
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

  return (
    <div className="thin-page" data-deck-ready={paintedDeck}>
      <EditorFrame
        top={
          <div className="flex items-center gap-4 px-4 py-2">
            <input
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
          notes={galleryDeck.notes}
          onExport={() => void onExport()}
          slide={
            <div>
              {ids.map((id) =>
                boxes.current.has(id) ? (
                  <Passage key={id} id={id} onEdit={(value) => void onEdit(id, value)} store={store.current} />
                ) : (
                  <Passage key={id} id={id} store={store.current} />
                ),
              )}
            </div>
          }
          slideLabel={galleryDeck.slideLabel}
          title={galleryDeck.title}
        />
      </EditorFrame>
    </div>
  )
}
