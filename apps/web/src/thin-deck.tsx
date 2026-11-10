import { currentValue, type Kind, type Register } from "@airdesign/document"
import { connect, getParts, httpRemote, memoryRemote, putParts, type Remote } from "@airdesign/live"
import { applyRoute, exportPackage, prepareMarkup, readPackage, readShapes, type ShapeKind } from "@airdesign/pptx"
import { Passage, elementId, paintStore, slideId, type ElementId, type PaintStore } from "@airdesign/render"
import { useEffect, useRef, useState } from "react"
import wasmUrl from "sax-wasm/lib/sax-wasm.wasm?url"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell } from "@/editor/editor-shell"
import { galleryDeck } from "@/editor/gallery-deck"
export const nodeA = { part: "ppt/slides/slide1.xml", shape: "2" }

export function elementNode(
  shapes: readonly { readonly slide: string; readonly part: string; readonly shape: string }[],
  node: { readonly part: string; readonly shape: string },
): string | undefined {
  const found = shapes.find((shape) => shape.part === node.part && shape.shape === node.shape)
  if (found === undefined) return undefined
  return `${found.slide}.${found.shape}`
}

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

function linkedId(node: { readonly part: string; readonly shape: string }): ElementId {
  return elementId(`${node.part}#${node.shape}`)
}

function paint(
  store: PaintStore,
  parts: ReadonlyMap<string, Uint8Array>,
  node: { readonly part: string; readonly shape: string },
  text: string | null,
): { readonly ids: readonly ElementId[]; readonly node: string | undefined } {
  const shapes = readShapes(parts)
  const anchor = linkedId(node)
  const next: ElementId[] = []
  for (const shape of shapes) {
    const id = elementId(`${shape.part}#${shape.shape}`)
    const kind = paintKind(shape.kind)
    store.publish({
      id,
      kind,
      text: id === anchor && text !== null ? text : shape.text,
      picture: kind === "picture" ? "" : null,
    })
    next.push(id)
  }
  store.setSlides([{ id: slideId("1"), elements: next }])
  return { ids: next, node: elementNode(shapes, node) }
}

type EditLink = {
  enqueue(deck: string, value: string, node?: string): Promise<{ readonly ok: boolean }>
  flush(deck: string): Promise<unknown>
}

export async function commitEdit(
  open: (remote: Remote) => EditLink,
  deckId: string,
  value: string,
  node: string,
  paint?: () => void,
): Promise<void> {
  const result = await open(memoryRemote()).enqueue(deckId, value, node)
  if (!result.ok) return
  paint?.()
  await open(httpRemote())
    .flush(deckId)
    .catch(() => undefined)
}

export function exportedParts(
  parts: ReadonlyMap<string, Uint8Array>,
  node: { readonly part: string; readonly shape: string },
  register: Register,
): ReadonlyMap<string, Uint8Array> {
  if (register.landed.length === 0) return parts
  return applyRoute(parts, { name: "text", part: node.part, shape: node.shape, text: currentValue(register) })
}

export async function saveDeck(parts: ReadonlyMap<string, Uint8Array>, file: Uint8Array): Promise<string | null> {
  const deckId = crypto.randomUUID()
  const saved = await putParts(deckId, { parts, file, nodes: { a: nodeA } })
  return saved.ok ? deckId : null
}

export function ThinDeck({ id }: { id?: string }) {
  const store = useRef(paintStore())
  const nodes = useRef(nodeA)
  const edited = useRef<string | undefined>(undefined)
  const [deckId, setDeckId] = useState(id)
  const [ids, setIds] = useState<readonly ElementId[]>([])

  useEffect(() => {
    if (id === undefined) return
    let live = true
    void (async () => {
      await ensureMarkup()
      const stored = await getParts(id)
      if (!stored.ok || !live) return
      const opened = await connect(memoryRemote()).openDeck(id)
      const text = opened.ok && opened.register.landed.length > 0 ? currentValue(opened.register) : null
      if (!live) return
      nodes.current = stored.nodes.a
      const painted = paint(store.current, stored.parts, stored.nodes.a, text)
      edited.current = painted.node
      setIds(painted.ids)
    })()
    return () => {
      live = false
    }
  }, [id])

  async function openFile(file: File) {
    await ensureMarkup()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const read = await readPackage(bytes)
    if (!read.ok) return
    const nextId = await saveDeck(read.parts, bytes)
    if (nextId === null) return
    window.history.replaceState(null, "", `/thin/${nextId}`)
    setDeckId(nextId)
    nodes.current = nodeA
    const painted = paint(store.current, read.parts, nodeA, null)
    edited.current = painted.node
    setIds(painted.ids)
  }

  async function onEdit(value: string) {
    const node = edited.current
    if (node === undefined || deckId === undefined) return
    await commitEdit(connect, deckId, value, node, () => {
      const id = linkedId(nodes.current)
      const record = store.current.getElement(id)
      if (record !== null) {
        store.current.publish({ id: record.id, kind: record.kind, text: value, picture: record.picture })
      }
    })
  }

  async function onExport() {
    if (deckId === undefined) return
    await ensureMarkup()
    const stored = await getParts(deckId)
    if (!stored.ok) return
    const opened = await connect(memoryRemote()).openDeck(deckId)
    if (!opened.ok) return
    const bytes = await exportPackage(stored.file, exportedParts(stored.parts, stored.nodes.a, opened.register))
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

  const anchor = linkedId(nodes.current)

  return (
    <div className="thin-page">
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
                id === anchor ? (
                  <Passage key={id} id={id} onEdit={(value) => void onEdit(value)} store={store.current} />
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
