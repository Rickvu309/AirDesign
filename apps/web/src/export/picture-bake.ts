import {
  landedPatch,
  readElementId,
  shapeOf,
  type ElementId,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { drawablePicture, installedPicture, paintReader, readSlides, type PaintBox } from "@airdesign/pptx"
import { cssColor } from "@/paint-css"
import { pictureFrame, type PictureImage } from "@/picture-fill"

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

export type BakePlan = {
  readonly width: number
  readonly height: number
  readonly draw: BakeDraw
  readonly blur: number
  readonly overlay: string | null
  readonly alpha: number | null
  readonly recolor: NonNullable<PictureImage["recolor"]> | null
}

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

export function bakePixels(image: PictureImage, box: BakeBox, natural: BakeBox): BakePlan {
  const canvas = canvasSize(box, natural)
  const plan = {
    width: canvas.width,
    height: canvas.height,
    blur: image.blur === undefined ? 0 : (image.blur * canvas.width * cssPerEmu) / box.width,
    overlay: image.overlay === undefined ? null : cssColor(image.overlay),
    alpha: image.alpha === undefined ? null : image.alpha,
    recolor: image.recolor ?? null,
  }
  if (image.tile) {
    const across = box.width / cssPerEmu
    const down = box.height / cssPerEmu
    return {
      ...plan,
      draw: {
        tile: true,
        stepX: (natural.width * canvas.width) / across,
        stepY: (natural.height * canvas.height) / down,
      },
    }
  }
  const frame = pictureFrame(image, canvas)
  if (frame === null) throw new Error("picture-bake")
  return { ...plan, draw: { tile: false, ...frame } }
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

function paintDraw(ctx: OffscreenCanvasRenderingContext2D, source: CanvasImageSource, plan: BakePlan) {
  const draw = plan.draw
  if (!draw.tile) {
    ctx.drawImage(source, draw.x, draw.y, draw.width, draw.height)
    return
  }
  if (!(draw.stepX > 0) || !(draw.stepY > 0)) throw new Error("picture-bake")
  for (let y = 0; y < plan.height; y += draw.stepY)
    for (let x = 0; x < plan.width; x += draw.stepX) ctx.drawImage(source, x, y, draw.stepX, draw.stepY)
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

async function raster(image: PictureImage, box: PaintBox, bytes: Uint8Array): Promise<Uint8Array> {
  const held = await sourceOf(bytes, image.contentType)
  try {
    const plan = bakePixels(image, box, sizeOf(held.source))
    const first = new OffscreenCanvas(plan.width, plan.height)
    const drawn = first.getContext("2d")
    if (drawn === null) throw new Error("picture-bake")
    paintDraw(drawn, held.source, plan)
    if (plan.recolor !== null) {
      const pixels = drawn.getImageData(0, 0, plan.width, plan.height)
      mix(pixels.data, plan.recolor)
      drawn.putImageData(pixels, 0, 0)
    }
    const second = new OffscreenCanvas(plan.width, plan.height)
    const out = second.getContext("2d")
    if (out === null) throw new Error("picture-bake")
    if (plan.blur > 0) out.filter = `blur(${String(plan.blur)}px)`
    out.drawImage(first, 0, 0)
    out.filter = "none"
    if (plan.overlay !== null) {
      out.globalCompositeOperation = "source-over"
      out.fillStyle = plan.overlay
      out.fillRect(0, 0, plan.width, plan.height)
    }
    if (plan.alpha !== null) {
      out.globalCompositeOperation = "destination-in"
      out.fillStyle = `rgba(0, 0, 0, ${String(plan.alpha)})`
      out.fillRect(0, 0, plan.width, plan.height)
    }
    const blob = await second.convertToBlob({ type: "image/png" })
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    held.release()
  }
}

function touched(patch: ElementPatch): boolean {
  const blur = patch.image?.blur
  const overlay = patch.image?.overlay
  return (typeof blur === "object" && blur.set > 0) || (typeof overlay === "object" && "solid" in overlay.set)
}

export async function bakeTouchedPictures(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
): Promise<ReadonlyMap<string, Uint8Array>> {
  const wanted: ElementId[] = []
  for (const key of Object.keys(register.elements)) {
    const node = readElementId(key)
    const body = node === undefined ? undefined : register.elements[node]
    if (node === undefined || body === undefined || !touched(landedPatch(body, "text"))) continue
    wanted.push(node)
  }
  if (wanted.length === 0) return parts
  const chosen: { readonly node: ReturnType<typeof shapeOf>; readonly part: string }[] = []
  const slides = readSlides(parts)
  for (const node of wanted) {
    const located = shapeOf(node)
    const part = slides.find((slide) => slide.slide === located.slide)?.part
    if (part === undefined || !parts.has(part)) continue
    chosen.push({ node: located, part })
  }
  if (chosen.length === 0) return parts
  const reader = paintReader(parts)
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const job of chosen) {
    const painted = reader.slide(job.part).elements.find((element) => element.shape === job.node.shape)
    const image = painted?.image ?? (painted?.fill?.type === "picture" ? painted.fill : null)
    const box = painted?.box ?? null
    const bytes = image === null ? undefined : parts.get(image.part)
    if (image === null || box === null || box.width <= 0 || box.height <= 0 || bytes === undefined)
      throw new Error("picture-bake")
    const png = await raster(image, box, bytes)
    next = installedPicture(next, { slide: job.node.slide, part: job.part, shape: job.node.shape }, png)
  }
  return next
}
