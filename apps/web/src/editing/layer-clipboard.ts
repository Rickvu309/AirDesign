import {
  mediaTypes,
  readBox,
  readElementId,
  readFloor,
  readSlideId,
  plainText,
  readTextValue,
  shapeOf,
  type Box,
  type ClonedLayer,
  type ElementId,
  type IndexElement,
  type MediaType,
  type SlideId,
} from "@airdesign/document"

export type CarriedImage = { readonly type: MediaType; readonly data: string }

export type CarriedLayer = { readonly markup: string; readonly images: readonly CarriedImage[] }

export type CopiedLayer = {
  readonly source: ElementId
  readonly box: Box
  readonly rows: readonly ClonedLayer[]
  readonly carried?: CarriedLayer
}

export type LayerCopy = {
  readonly deck: string
  readonly slide: SlideId
  readonly layers: readonly CopiedLayer[]
}

const marker = "data-airdesign-layers"
const found = new RegExp(`${marker}="([A-Za-z0-9+/=]+)"`)
const largest = 8_000_000

export function base64Of(bytes: Uint8Array): string {
  let binary = ""
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return btoa(binary)
}

export function bytesOf64(base64: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(base64), (each) => each.charCodeAt(0))
  } catch {
    return null
  }
}

function encoded(text: string): string {
  return base64Of(new TextEncoder().encode(text))
}

function decoded(base64: string): string | null {
  const bytes = bytesOf64(base64)
  try {
    return bytes === null ? null : new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function escaped(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function valueText(value: string | null): string {
  if (value === null) return ""
  const paragraphs = readTextValue(value)
  return paragraphs === null ? value : plainText(paragraphs)
}

export function layerText(copy: LayerCopy): string {
  return copy.layers
    .flatMap((layer) => layer.rows.map((row) => valueText(row.element.value)))
    .filter((text) => text.trim() !== "")
    .join("\n")
}

function rowHtml(value: string | null): string {
  return valueText(value).split("\n").map(escaped).join("<br>")
}

export function layerCopyHtml(copy: LayerCopy): string {
  const shown = copy.layers
    .flatMap((layer) => layer.rows.filter((row) => valueText(row.element.value).trim() !== ""))
    .map((row) => rowHtml(row.element.value))
    .join("<br>")
  return `<meta charset="utf-8"><div ${marker}="${encoded(JSON.stringify(copy))}">${shown}</div>`
}

function record(raw: unknown): Readonly<Record<string, unknown>> | null {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
}

function readRows(raw: unknown, slide: SlideId): readonly ClonedLayer[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const sources: ElementId[] = []
  const elements: unknown[] = []
  for (const item of raw) {
    const row = record(item)
    const source = readElementId(row?.source)
    if (source === undefined || shapeOf(source).slide !== slide) return null
    sources.push(source)
    elements.push(row?.element)
  }
  const floor: readonly IndexElement[] | undefined = readFloor(elements, slide)
  if (floor === undefined) return null
  return sources.flatMap((source, at) => {
    const element = floor[at]
    return element === undefined ? [] : [{ source, element }]
  })
}

function readCarried(raw: unknown): CarriedLayer | null | undefined {
  if (raw === undefined) return undefined
  const carried = record(raw)
  if (carried === null || typeof carried.markup !== "string" || !Array.isArray(carried.images)) return null
  const images = carried.images.map((item) => {
    const image = record(item)
    const type = mediaTypes.find((each) => each === image?.type)
    return type === undefined || typeof image?.data !== "string" ? null : { type, data: image.data }
  })
  if (images.some((image) => image === null)) return null
  return { markup: carried.markup, images: images.filter((image) => image !== null) }
}

function readLayer(raw: unknown, slide: SlideId): CopiedLayer | null {
  const layer = record(raw)
  const source = readElementId(layer?.source)
  const box = readBox(layer?.box)
  const rows = readRows(layer?.rows, slide)
  const carried = readCarried(layer?.carried)
  if (source === undefined || box === null || rows === null || shapeOf(source).slide !== slide) return null
  if (rows[0]?.source !== source || carried === null) return null
  return { source, box, rows, ...(carried === undefined ? {} : { carried }) }
}

export function readLayerCopy(html: string): LayerCopy | null {
  if (html.length > largest) return null
  const base64 = found.exec(html)?.[1]
  const text = base64 === undefined ? null : decoded(base64)
  if (text === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  const copy = record(parsed)
  const slide = readSlideId(copy?.slide)
  if (copy === null || typeof copy.deck !== "string" || slide === undefined || !Array.isArray(copy.layers)) return null
  const layers = copy.layers.map((layer) => readLayer(layer, slide))
  if (layers.length === 0 || layers.some((layer) => layer === null)) return null
  return { deck: copy.deck, slide, layers: layers.filter((layer) => layer !== null) }
}

let kept: LayerCopy | null = null

export function writeLayerCopy(copy: LayerCopy, data: DataTransfer) {
  data.setData("text/html", layerCopyHtml(copy))
  data.setData("text/plain", layerText(copy))
  kept = copy
}

export async function readClipboardCopy(): Promise<LayerCopy | null> {
  let items: readonly ClipboardItem[]
  try {
    items = await navigator.clipboard.read()
  } catch {
    return kept
  }
  for (const item of items) {
    if (!item.types.includes("text/html")) continue
    const copy = readLayerCopy(await (await item.getType("text/html")).text())
    if (copy !== null) return copy
  }
  return null
}
