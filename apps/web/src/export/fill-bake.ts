import { landedPatch, readElementId, shapeOf, type ElementPatch, type Register } from "@airdesign/document"
import {
  bakedFill,
  clearedInners,
  drawablePicture,
  installedPicture,
  paintReader,
  readSlides,
  strippedStacks,
  type PaintBox,
  type PaintElement,
  type PaintInner,
} from "@airdesign/pptx"
import { fillPlan, type PlanLayer } from "@/fill-plan"
import { cssColor } from "@/paint-css"
import type { PictureImage } from "@/picture-fill"

const inch = 914_400
const dots = 192
const longest = 4_096
const cssPerEmu = 9_525

const browserTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/bmp",
  "image/webp",
  "image/svg+xml",
  "image/avif",
])

export type BakeBox = { readonly width: number; readonly height: number }

type BakeDraw =
  | { readonly tile: true; readonly stepX: number; readonly stepY: number }
  | { readonly tile: false; readonly x: number; readonly y: number; readonly width: number; readonly height: number }

type ImageBake = {
  readonly kind: "image"
  readonly image: PictureImage
  readonly draw: BakeDraw
  readonly blur: number
  readonly overlay: string | null
  readonly alpha: number | null
  readonly recolor: NonNullable<PictureImage["recolor"]> | null
}

type InnerBake = {
  readonly kind: "inner"
  readonly color: string
  readonly blur: number
  readonly dx: number
  readonly dy: number
}

type LayerBake =
  | { readonly kind: "color"; readonly color: string }
  | { readonly kind: "gradient"; readonly gradient: Extract<PlanLayer, { kind: "gradient" }>["gradient"] }
  | ImageBake
  | InnerBake

export type BakePlan = { readonly width: number; readonly height: number; readonly layers: readonly LayerBake[] }

type HeldSource = { readonly source: CanvasImageSource; readonly release: () => void }

function canvasSize(box: BakeBox, natural: BakeBox): BakeBox {
  const width = (box.width / inch) * dots
  const height = (box.height / inch) * dots
  if (!(width > 0) || !(height > 0) || !(natural.width > 0) || !(natural.height > 0)) throw new Error("picture-bake")
  const scale = Math.max(1, natural.width / width, natural.height / height)
  let across = width * scale
  let down = height * scale
  const long = Math.max(across, down)
  if (long > longest) {
    across *= longest / long
    down *= longest / long
  }
  return { width: Math.max(1, Math.round(across)), height: Math.max(1, Math.round(down)) }
}

function imageBake(
  layer: Extract<PlanLayer, { kind: "image" }>,
  canvas: BakeBox,
  box: BakeBox,
  natural: BakeBox,
): ImageBake {
  const image = layer.image
  const adjusted = {
    kind: "image" as const,
    image,
    blur: image.blur === undefined ? 0 : (image.blur * canvas.width * cssPerEmu) / box.width,
    overlay: image.overlay === undefined ? null : cssColor(image.overlay),
    alpha: image.alpha === undefined ? null : image.alpha,
    recolor: image.recolor ?? null,
  }
  const placed = layer.placed
  if (placed.tile) {
    const stepX = (natural.width * canvas.width) / (box.width / cssPerEmu)
    const stepY = (natural.height * canvas.height) / (box.height / cssPerEmu)
    return { ...adjusted, draw: { tile: true, stepX, stepY } }
  }
  const { x, y, width, height } = placed
  return {
    ...adjusted,
    draw: {
      tile: false,
      x: x * canvas.width,
      y: y * canvas.height,
      width: width * canvas.width,
      height: height * canvas.height,
    },
  }
}

function planOf(row: PaintElement): readonly PlanLayer[] {
  const inners = (row.effects?.inners ?? []).map((inner): PlanLayer => ({ kind: "inner", inner }))
  return [...fillPlan(row), ...inners]
}

function innerBake(inner: PaintInner, canvas: BakeBox, box: BakeBox): InnerBake {
  const scale = canvas.width / box.width
  const turn = (inner.direction * Math.PI) / 180
  const distance = inner.distance * scale
  return {
    kind: "inner",
    color: cssColor(inner.color),
    blur: (inner.blur * scale) / 2,
    dx: Math.cos(turn) * distance,
    dy: Math.sin(turn) * distance,
  }
}

export function bakePlan(plan: readonly PlanLayer[], box: BakeBox, natural: BakeBox | null): BakePlan {
  const canvas = canvasSize(box, natural ?? { width: 1, height: 1 })
  const layers = plan.map((layer): LayerBake => {
    if (layer.kind === "color") return { kind: "color", color: cssColor(layer.color) }
    if (layer.kind === "gradient") return layer
    if (layer.kind === "inner") return innerBake(layer.inner, canvas, box)
    return imageBake(layer, canvas, box, natural ?? { width: 1, height: 1 })
  })
  return { ...canvas, layers }
}

function copied(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

function rgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(0, 6), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function mix(data: Uint8ClampedArray, recolor: NonNullable<PictureImage["recolor"]>) {
  const duotone = "duotone" in recolor ? recolor.duotone : null
  const dark = duotone === null ? null : rgb(duotone[0].hex)
  const light = duotone === null ? null : rgb(duotone[1].hex)
  for (let at = 0; at < data.length; at += 4) {
    const y = 0.2126 * (data[at] ?? 0) + 0.7152 * (data[at + 1] ?? 0) + 0.0722 * (data[at + 2] ?? 0)
    if (dark === null || light === null) {
      const gray = Math.round(y)
      data[at] = gray
      data[at + 1] = gray
      data[at + 2] = gray
      continue
    }
    const tone = y / 255
    data[at] = Math.round(dark[0] + (light[0] - dark[0]) * tone)
    data[at + 1] = Math.round(dark[1] + (light[1] - dark[1]) * tone)
    data[at + 2] = Math.round(dark[2] + (light[2] - dark[2]) * tone)
  }
}

function paintDraw(ctx: OffscreenCanvasRenderingContext2D, source: CanvasImageSource, layer: ImageBake, size: BakeBox) {
  const draw = layer.draw
  if (!draw.tile) {
    ctx.drawImage(source, draw.x, draw.y, draw.width, draw.height)
    return
  }
  if (!(draw.stepX > 0) || !(draw.stepY > 0)) throw new Error("picture-bake")
  for (let y = 0; y < size.height; y += draw.stepY)
    for (let x = 0; x < size.width; x += draw.stepX) ctx.drawImage(source, x, y, draw.stepX, draw.stepY)
}

function gradientStyle(
  ctx: OffscreenCanvasRenderingContext2D,
  gradient: Extract<LayerBake, { kind: "gradient" }>["gradient"],
  size: BakeBox,
): CanvasGradient {
  const { width, height } = size
  if (gradient.angle === null) {
    const style = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, (width / 2) * Math.SQRT2)
    for (const stop of gradient.stops) style.addColorStop(stop.position, cssColor(stop.color))
    return style
  }
  const turn = ((gradient.angle + 90) * Math.PI) / 180
  const across = Math.sin(turn)
  const down = -Math.cos(turn)
  const half = (Math.abs(width * across) + Math.abs(height * down)) / 2
  const style = ctx.createLinearGradient(
    width / 2 - across * half,
    height / 2 - down * half,
    width / 2 + across * half,
    height / 2 + down * half,
  )
  for (const stop of gradient.stops) style.addColorStop(stop.position, cssColor(stop.color))
  return style
}

function paintGradient(
  ctx: OffscreenCanvasRenderingContext2D,
  gradient: Extract<LayerBake, { kind: "gradient" }>["gradient"],
  size: BakeBox,
) {
  ctx.save()
  if (gradient.angle === null) {
    ctx.translate(0, size.height / 2)
    ctx.scale(1, size.height / size.width)
    ctx.translate(0, -size.width / 2)
    ctx.fillStyle = gradientStyle(ctx, gradient, { width: size.width, height: size.width })
    ctx.fillRect(0, 0, size.width, size.width)
  } else {
    ctx.fillStyle = gradientStyle(ctx, gradient, size)
    ctx.fillRect(0, 0, size.width, size.height)
  }
  ctx.restore()
}

function sizeOf(source: CanvasImageSource): BakeBox {
  if (source instanceof ImageBitmap) return { width: source.width, height: source.height }
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight }
  throw new Error("picture-bake")
}

async function sourceOf(bytes: Uint8Array, type: string | null): Promise<HeldSource> {
  const named = type?.toLowerCase() ?? ""
  let mime = named
  let data: BlobPart = copied(bytes)
  if (!browserTypes.has(named)) {
    const drawn = drawablePicture(bytes)
    if (drawn === null) throw new Error("picture-bake")
    mime = drawn.contentType
    data = typeof drawn.data === "string" ? drawn.data : copied(drawn.data)
  }
  const blob = new Blob([data], { type: mime })
  if (mime === "image/svg+xml") {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      URL.revokeObjectURL(url)
      throw new Error("picture-bake")
    }
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      URL.revokeObjectURL(url)
      throw new Error("picture-bake")
    }
    return { source: image, release: () => URL.revokeObjectURL(url) }
  }
  try {
    const bitmap = await createImageBitmap(blob)
    return { source: bitmap, release: () => bitmap.close() }
  } catch {
    throw new Error("picture-bake")
  }
}

function imageLayer(source: CanvasImageSource, layer: ImageBake, size: BakeBox): OffscreenCanvas {
  const first = new OffscreenCanvas(size.width, size.height)
  const drawn = first.getContext("2d")
  if (drawn === null) throw new Error("picture-bake")
  paintDraw(drawn, source, layer, size)
  if (layer.recolor !== null) {
    const pixels = drawn.getImageData(0, 0, size.width, size.height)
    mix(pixels.data, layer.recolor)
    drawn.putImageData(pixels, 0, 0)
  }
  const second = new OffscreenCanvas(size.width, size.height)
  const out = second.getContext("2d")
  if (out === null) throw new Error("picture-bake")
  if (layer.blur > 0) out.filter = `blur(${String(layer.blur)}px)`
  out.drawImage(first, 0, 0)
  out.filter = "none"
  if (layer.overlay !== null) {
    out.globalCompositeOperation = "source-over"
    out.fillStyle = layer.overlay
    out.fillRect(0, 0, size.width, size.height)
  }
  if (layer.alpha !== null) {
    out.globalCompositeOperation = "destination-in"
    out.fillStyle = `rgba(0, 0, 0, ${String(layer.alpha)})`
    out.fillRect(0, 0, size.width, size.height)
  }
  return second
}

function paintInner(out: OffscreenCanvasRenderingContext2D, layer: InnerBake, size: BakeBox) {
  const margin = Math.max(1, Math.ceil(layer.blur * 3 + Math.abs(layer.dx) + Math.abs(layer.dy)))
  const scratch = new OffscreenCanvas(size.width + margin * 2, size.height + margin * 2)
  const ctx = scratch.getContext("2d")
  if (ctx === null) throw new Error("picture-bake")
  ctx.fillStyle = layer.color
  ctx.fillRect(0, 0, scratch.width, scratch.height)
  ctx.globalCompositeOperation = "destination-out"
  ctx.fillRect(margin, margin, size.width, size.height)
  const blurred = new OffscreenCanvas(scratch.width, scratch.height)
  const soft = blurred.getContext("2d")
  if (soft === null) throw new Error("picture-bake")
  if (layer.blur > 0) soft.filter = `blur(${String(layer.blur)}px)`
  soft.drawImage(scratch, 0, 0)
  out.save()
  out.beginPath()
  out.rect(0, 0, size.width, size.height)
  out.clip()
  out.drawImage(blurred, layer.dx - margin, layer.dy - margin)
  out.restore()
}

async function raster(row: PaintElement, box: PaintBox, parts: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const plan = planOf(row)
  const pictured = plan.find((layer) => layer.kind === "image")
  const bytes = pictured === undefined ? undefined : parts.get(pictured.image.part)
  if (pictured !== undefined && bytes === undefined) throw new Error("picture-bake")
  const held = pictured === undefined || bytes === undefined ? null : await sourceOf(bytes, pictured.image.contentType)
  try {
    const baked = bakePlan(plan, box, held === null ? null : sizeOf(held.source))
    const size = { width: baked.width, height: baked.height }
    const canvas = new OffscreenCanvas(size.width, size.height)
    const out = canvas.getContext("2d")
    if (out === null) throw new Error("picture-bake")
    for (const layer of baked.layers) {
      if (layer.kind === "color") {
        out.fillStyle = layer.color
        out.fillRect(0, 0, size.width, size.height)
      } else if (layer.kind === "gradient") paintGradient(out, layer.gradient, size)
      else if (layer.kind === "inner") paintInner(out, layer, size)
      else if (held !== null) out.drawImage(imageLayer(held.source, layer, size), 0, 0)
    }
    const blob = await canvas.convertToBlob({ type: "image/png" })
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    held?.release()
  }
}

function touched(patch: ElementPatch): boolean {
  const blur = patch.fills?.blur
  return typeof blur === "object" && blur.set > 0
}

function touchedShapes(register: Register): ReadonlySet<string> {
  const shapes = new Set<string>()
  for (const key of Object.keys(register.elements)) {
    const node = readElementId(key)
    const body = node === undefined ? undefined : register.elements[node]
    if (node === undefined || body === undefined || !touched(landedPatch(body, "text"))) continue
    const located = shapeOf(node)
    shapes.add(`${located.slide}.${located.shape}`)
  }
  return shapes
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", copied(bytes)))
  return [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function bakeFills(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
): Promise<ReadonlyMap<string, Uint8Array>> {
  const touchedNodes = touchedShapes(register)
  const reader = paintReader(parts)
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const slide of readSlides(parts)) {
    for (const row of reader.slide(slide.part).elements) {
      if (row.from !== "slide" || row.box === null) continue
      const stacked = row.stack !== undefined
      const extraInner = (row.effects?.inners?.length ?? 0) > 0
      if (!stacked && !extraInner && !touchedNodes.has(`${slide.slide}.${row.shape}`)) continue
      if (row.box.width <= 0 || row.box.height <= 0) throw new Error("picture-bake")
      const png = await raster(row, row.box, parts)
      const at = { slide: slide.slide, part: slide.part, shape: row.shape }
      next = stacked || extraInner ? bakedFill(next, at, png, await sha256(png)) : installedPicture(next, at, png)
      if (extraInner) next = clearedInners(next, at)
    }
  }
  return strippedStacks(next)
}
