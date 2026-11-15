import { base64 } from "./bitmap-file.js"
import { pairedBlit, pairedOperations } from "./metafile-pair.js"
import { arcPoints, ellipsePoints, roundPoints, type Curve } from "./metafile-curve.js"
import { textMarkup, type TextRun } from "./metafile-text.js"
import {
  anisotropic,
  applied,
  identity,
  isotropic,
  multiplied,
  nullStyle,
  opaqueBack,
  round,
  scaleOf,
  startState,
  stockHandles,
  type Box,
  type Brush,
  type DrawState,
  type Handle,
  type Mapping,
  type Matrix,
  type Point,
} from "./metafile-state.js"

export type Frame = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export type Bitmap = {
  readonly file: Uint8Array
  readonly width: number
  readonly height: number
  readonly bottomUp: boolean
}

export type Blit = {
  readonly dest: Box
  readonly source: Box
  readonly bitmap: Bitmap | null
  readonly operation: number
  readonly opacity: number
}

const fixedScales: Readonly<Record<number, number>> = { 2: 0.1, 3: 0.01, 4: 0.254, 5: 0.0254, 6: 25.4 / 1440 }
const blends: Readonly<Record<number, string>> = { 0x8800c6: "multiply", 0xee0086: "lighten", 0x660046: "difference" }
const sourceFree = new Set([0xf00021, 0x5a0049, 0x000042, 0xff0062])
const dashes: Readonly<Record<number, readonly number[]>> = {
  1: [3, 1],
  2: [1, 1],
  3: [3, 1, 1, 1],
  4: [3, 1, 1, 1, 1, 1],
}
const caps: Readonly<Record<number, string>> = { 0: "round", 0x100: "square", 0x200: "butt" }
const joins: Readonly<Record<number, string>> = { 0: "round", 0x1000: "bevel", 0x2000: "miter" }
const hatchLines: Readonly<Record<number, string>> = {
  0: "M0 4H8",
  1: "M4 0V8",
  2: "M0 0L8 8",
  3: "M0 8L8 0",
  4: "M0 4H8M4 0V8",
  5: "M0 0L8 8M0 8L8 0",
}

export class Playback {
  private state: DrawState
  private readonly saved: DrawState[] = []
  private readonly handles = new Map<number, Handle>()
  private readonly defs: string[] = []
  private readonly body: string[] = []
  private path: string[] | null = null
  private figure: Point | null = null
  private made = 0
  private waiting: Blit | null = null
  private readonly frame: Frame
  private readonly pixelsPerMillimeter: number

  constructor(frame: Frame, pixelsPerMillimeter: number, mapping: Mapping) {
    this.frame = frame
    this.pixelsPerMillimeter = pixelsPerMillimeter
    this.state = startState(mapping)
  }

  private flush(): void {
    const waiting = this.waiting
    this.waiting = null
    if (waiting !== null) this.place(waiting)
  }

  svg(): string {
    this.flush()
    const { x, y, width, height } = this.frame
    const box = [x, y, width, height].map(round).join(" ")
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${round(width)}" height="${round(height)}" viewBox="${box}" preserveAspectRatio="none"><defs>${this.defs.join("")}</defs>${this.body.join("")}</svg>`
  }

  get current(): DrawState {
    return this.state
  }

  set(change: Partial<DrawState>): void {
    this.state = { ...this.state, ...change }
  }

  map(change: Partial<Mapping>): void {
    this.state = { ...this.state, mapping: { ...this.state.mapping, ...change } }
  }

  save(): void {
    this.saved.push(this.state)
  }

  restore(relative: number): void {
    const depth = relative < 0 ? this.saved.length + relative : relative - 1
    if (depth < 0 || depth >= this.saved.length) return
    this.state = this.saved[depth] ?? this.state
    this.saved.length = depth
  }

  modifyWorld(matrix: Matrix, mode: number): void {
    const world = this.state.mapping.world
    if (mode === 1) this.map({ world: identity })
    else if (mode === 2) this.map({ world: multiplied(matrix, world) })
    else if (mode === 3) this.map({ world: multiplied(world, matrix) })
    else if (mode === 4) this.map({ world: matrix })
  }

  create(index: number, handle: Handle): void {
    this.handles.set(index, handle)
  }

  freeIndex(): number {
    let index = 0
    while (this.handles.has(index)) index += 1
    return index
  }

  select(index: number): void {
    const handle = index >= 0x80000000 ? stockHandles.get(index - 0x80000000) : this.handles.get(index)
    if (handle === undefined || handle.kind === "other") return
    if (handle.kind === "pen") this.set({ pen: handle })
    else if (handle.kind === "brush") this.set({ brush: handle })
    else this.set({ font: handle })
  }

  remove(index: number): void {
    this.handles.delete(index)
  }

  handle(index: number): Handle | undefined {
    return this.handles.get(index)
  }

  matrix(): Matrix {
    const { mode, windowOrigin, windowExtent, viewportOrigin, viewportExtent, world } = this.state.mapping
    let scaleX = 1
    let scaleY = 1
    if (mode === anisotropic || mode === isotropic) {
      scaleX = windowExtent[0] === 0 ? 1 : viewportExtent[0] / windowExtent[0]
      scaleY = windowExtent[1] === 0 ? 1 : viewportExtent[1] / windowExtent[1]
      if (mode === isotropic) {
        const both = Math.min(Math.abs(scaleX), Math.abs(scaleY))
        scaleX = Math.sign(scaleX || 1) * both
        scaleY = Math.sign(scaleY || 1) * both
      }
    } else if (fixedScales[mode] !== undefined) {
      scaleX = (fixedScales[mode] ?? 1) * this.pixelsPerMillimeter
      scaleY = -scaleX
    }
    const page: Matrix = [
      scaleX,
      0,
      0,
      scaleY,
      viewportOrigin[0] - windowOrigin[0] * scaleX,
      viewportOrigin[1] - windowOrigin[1] * scaleY,
    ]
    return multiplied(world, page)
  }

  device(point: Point): Point {
    return applied(this.matrix(), point)
  }

  moveTo(point: Point): void {
    this.set({ at: point })
    if (this.path !== null) {
      this.path.push(`M${this.spot(point)}`)
      this.figure = point
    }
  }

  lineTo(points: readonly Point[]): void {
    if (points.length === 0) return
    if (this.path !== null) {
      if (this.figure === null) this.moveTo(this.state.at)
      this.path.push(...points.map((point) => `L${this.spot(point)}`))
    } else {
      this.stroke(`M${this.spot(this.state.at)}${points.map((point) => `L${this.spot(point)}`).join("")}`)
    }
    this.set({ at: points.at(-1) ?? this.state.at })
  }

  bezierTo(points: readonly Point[]): void {
    const usable = points.length - (points.length % 3)
    if (usable === 0) return
    const curves: string[] = []
    for (let at = 0; at < usable; at += 3) {
      const [first, second, third] = [points[at], points[at + 1], points[at + 2]]
      if (first === undefined || second === undefined || third === undefined) break
      curves.push(`C${this.spot(first)} ${this.spot(second)} ${this.spot(third)}`)
    }
    if (this.path !== null) {
      if (this.figure === null) this.moveTo(this.state.at)
      this.path.push(...curves)
    } else this.stroke(`M${this.spot(this.state.at)}${curves.join("")}`)
    this.set({ at: points[usable - 1] ?? this.state.at })
  }

  polyline(points: readonly Point[]): void {
    const [first, ...rest] = points
    if (first === undefined) return
    const kept = this.state.at
    if (this.path !== null) {
      this.moveTo(first)
      this.lineTo(rest)
      return
    }
    this.stroke(`M${this.spot(first)}${rest.map((point) => `L${this.spot(point)}`).join("")}`)
    this.set({ at: kept })
  }

  polyBezier(points: readonly Point[]): void {
    const [first, ...rest] = points
    if (first === undefined) return
    const kept = this.state.at
    if (this.path !== null) {
      this.moveTo(first)
      this.bezierTo(rest)
      return
    }
    this.set({ at: first })
    this.path = []
    this.bezierTo(rest)
    const outline = this.path.join("")
    this.path = null
    this.stroke(`M${this.spot(first)}${outline}`)
    this.set({ at: kept })
  }

  polygon(shapes: readonly (readonly Point[])[]): void {
    const outline = shapes
      .filter((points) => points.length > 1)
      .map((points) => `M${points.map((point) => this.spot(point)).join("L")}Z`)
      .join("")
    this.closed(outline)
  }

  rectangle(box: Box): void {
    const { left, top, right, bottom } = box
    this.polygon([
      [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom],
      ],
    ])
  }

  ellipse(box: Box): void {
    this.closed(this.curve(ellipsePoints(box)) + "Z")
  }

  roundRectangle(box: Box, corner: Point): void {
    this.closed(this.curve(roundPoints(box, corner)) + "Z")
  }

  arc(kind: "arc" | "chord" | "pie", box: Box, start: Point, end: Point): void {
    const curve = arcPoints(box, start, end)
    if (kind === "arc") {
      if (this.path !== null) this.path.push(this.curve(curve))
      else this.stroke(this.curve(curve))
      return
    }
    const center: Point = [(box.left + box.right) / 2, (box.top + box.bottom) / 2]
    this.closed(this.curve(curve) + (kind === "pie" ? `L${this.spot(center)}` : "") + "Z")
  }

  beginPath(): void {
    this.path = []
    this.figure = null
  }

  endPath(): void {
    this.figure = null
  }

  closeFigure(): void {
    if (this.path !== null && this.figure !== null) {
      this.path.push("Z")
      this.set({ at: this.figure })
    }
  }

  abortPath(): void {
    this.path = null
    this.figure = null
  }

  takePath(): string {
    const outline = (this.path ?? []).join("")
    this.path = null
    this.figure = null
    return outline
  }

  fillPath(stroke: boolean, fill: boolean): void {
    const outline = this.takePath()
    if (outline === "") return
    this.draw(outline, fill, stroke)
  }

  clipPath(mode: number): void {
    const outline = this.takePath()
    if (outline !== "") this.clip(`<path d="${outline}" clip-rule="${this.rule()}"/>`, mode)
  }

  clipBox(box: Box, mode: number): void {
    const corners: Point[] = [
      [box.left, box.top],
      [box.right, box.top],
      [box.right, box.bottom],
      [box.left, box.bottom],
    ]
    this.clip(`<path d="M${corners.map((point) => this.spot(point)).join("L")}Z"/>`, mode)
  }

  excludeBox(box: Box): void {
    const { x, y, width, height } = this.frame
    const outer = `M${round(x - width)} ${round(y - height)}h${round(width * 3)}v${round(height * 3)}h${round(-width * 3)}Z`
    const corners: Point[] = [
      [box.left, box.top],
      [box.right, box.top],
      [box.right, box.bottom],
      [box.left, box.bottom],
    ]
    this.clip(`<path clip-rule="evenodd" d="${outer}M${corners.map((point) => this.spot(point)).join("L")}Z"/>`, 1)
  }

  clipDevice(boxes: readonly Box[], mode: number): void {
    if (boxes.length === 0) {
      if (mode === 5) this.set({ clip: null })
      return
    }
    const outline = boxes
      .map(
        ({ left, top, right, bottom }) =>
          `M${round(left)} ${round(top)}H${round(right)}V${round(bottom)}H${round(left)}Z`,
      )
      .join("")
    this.clip(`<path d="${outline}"/>`, mode)
  }

  fillDevice(boxes: readonly Box[], brush: Brush): void {
    const outline = boxes
      .map(
        ({ left, top, right, bottom }) =>
          `M${round(left)} ${round(top)}H${round(right)}V${round(bottom)}H${round(left)}Z`,
      )
      .join("")
    if (outline !== "") this.put(`<path d="${outline}"${this.paint(brush)}/>`)
  }

  text(run: TextRun): void {
    const markup = textMarkup(run, this.state, this.matrix())
    if (run.opaque !== null) {
      const back = { ...this.state.brush, color: this.state.backColor, style: 0, pattern: null }
      const [left, top] = this.device([run.opaque.left, run.opaque.top])
      const [right, bottom] = this.device([run.opaque.right, run.opaque.bottom])
      this.fillDevice([{ left, top, right, bottom }], back)
    }
    if (markup !== "") this.put(markup)
  }

  blit(blit: Blit): void {
    const waiting = this.waiting
    this.waiting = null
    const paired = waiting === null ? null : pairedBlit(waiting, blit)
    if (paired !== null) return this.place(paired)
    if (waiting !== null) this.place(waiting)
    if (blit.bitmap !== null && pairedOperations.has(blit.operation)) this.waiting = blit
    else this.place(blit)
  }

  private place(blit: Blit): void {
    const [left, top] = this.device([blit.dest.left, blit.dest.top])
    const [right, bottom] = this.device([blit.dest.right, blit.dest.bottom])
    const width = Math.abs(right - left)
    const height = Math.abs(bottom - top)
    if (width === 0 || height === 0) return
    const x = Math.min(left, right)
    const y = Math.min(top, bottom)
    const box = `x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}"`
    if (blit.bitmap === null) {
      if (!sourceFree.has(blit.operation)) return
      const brush =
        blit.operation === 0x42
          ? { ...this.state.brush, color: "black", style: 0, pattern: null }
          : blit.operation === 0xff0062
            ? { ...this.state.brush, color: "white", style: 0, pattern: null }
            : this.state.brush
      this.put(`<rect ${box}${this.paint(brush)}/>`)
      return
    }
    const { file, width: pixelsWide, height: pixelsHigh } = blit.bitmap
    const { source } = blit
    const view = [source.left, source.top, source.right - source.left, source.bottom - source.top].map(round).join(" ")
    const flips = [right < left ? -1 : 1, bottom < top ? -1 : 1] as const
    const turned =
      flips[0] === 1 && flips[1] === 1
        ? ""
        : ` transform="matrix(${flips[0]} 0 0 ${flips[1]} ${round(flips[0] === 1 ? 0 : 2 * x + width)} ${round(flips[1] === 1 ? 0 : 2 * y + height)})"`
    const blend = blends[blit.operation]
    const style = [
      blend === undefined ? "" : `mix-blend-mode:${blend}`,
      blit.opacity < 1 ? `opacity:${round(blit.opacity)}` : "",
    ]
      .filter((part) => part !== "")
      .join(";")
    const image = `<image width="${pixelsWide}" height="${pixelsHigh}" preserveAspectRatio="none" xlink:href="data:image/bmp;base64,${base64(file)}"/>`
    this.put(
      `<g${turned}${style === "" ? "" : ` style="${style}"`}><svg ${box} viewBox="${view}" preserveAspectRatio="none">${image}</svg></g>`,
    )
  }

  pattern(bitmap: Bitmap): string {
    const id = this.id("p")
    this.defs.push(
      `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${bitmap.width}" height="${bitmap.height}"><image width="${bitmap.width}" height="${bitmap.height}" xlink:href="data:image/bmp;base64,${base64(bitmap.file)}"/></pattern>`,
    )
    return id
  }

  private id(prefix: string): string {
    this.made += 1
    return `${prefix}${this.made}`
  }

  private spot(point: Point): string {
    const [x, y] = this.device(point)
    return `${round(x)} ${round(y)}`
  }

  private curve(curve: Curve): string {
    const [start, ...rest] = curve
    if (start === undefined) return ""
    const pieces = [`M${this.spot(start)}`]
    for (let at = 0; at + 2 < rest.length; at += 3) {
      const [first, second, third] = [rest[at], rest[at + 1], rest[at + 2]]
      if (first !== undefined && second !== undefined && third !== undefined)
        pieces.push(`C${this.spot(first)} ${this.spot(second)} ${this.spot(third)}`)
    }
    return pieces.join("")
  }

  private rule(): string {
    return this.state.fillMode === 2 ? "nonzero" : "evenodd"
  }

  private closed(outline: string): void {
    if (outline === "") return
    if (this.path !== null) {
      this.path.push(outline)
      this.figure = null
      return
    }
    this.draw(outline, true, true)
  }

  private stroke(outline: string): void {
    this.draw(outline, false, true)
  }

  private draw(outline: string, fill: boolean, stroke: boolean): void {
    const filled = fill ? this.paint(this.state.brush) : ' fill="none"'
    const stroked = stroke ? this.line() : ""
    if (filled === ' fill="none"' && stroked === "") return
    this.put(`<path d="${outline}"${filled}${stroked}/>`)
  }

  private paint(brush: Brush): string {
    if (brush.style === 1) return ' fill="none"'
    const rule = ` fill-rule="${this.rule()}"`
    if (brush.pattern !== null) return ` fill="url(#${brush.pattern})"${rule}`
    if (brush.style !== 2) return ` fill="${brush.color}"${rule}`
    const id = this.id("h")
    const back = this.state.backMode === opaqueBack ? `<rect width="8" height="8" fill="${this.state.backColor}"/>` : ""
    const lines = hatchLines[brush.hatch] ?? hatchLines[0] ?? ""
    this.defs.push(
      `<pattern id="${id}" patternUnits="userSpaceOnUse" width="8" height="8">${back}<path d="${lines}" stroke="${brush.color}" stroke-width="1"/></pattern>`,
    )
    return ` fill="url(#${id})"${rule}`
  }

  private line(): string {
    const pen = this.state.pen
    const kind = pen.style & 15
    if (kind === nullStyle) return ""
    const width = pen.width === 0 ? 1 : Math.max(pen.width * scaleOf(this.matrix()), 0.5)
    const pattern = dashes[kind]
    const dash =
      pattern === undefined ? "" : ` stroke-dasharray="${pattern.map((part) => round(part * width)).join(" ")}"`
    const geometric = (pen.style & 0x10000) !== 0
    const cap = geometric ? (caps[pen.style & 0xf00] ?? "round") : "round"
    const join = geometric ? (joins[pen.style & 0xf000] ?? "round") : "round"
    return ` stroke="${pen.color}" stroke-width="${round(width)}" stroke-linecap="${cap}" stroke-linejoin="${join}"${dash}`
  }

  private clip(shape: string, mode: number): void {
    if (mode !== 1 && mode !== 5) return
    const parent = mode === 1 && this.state.clip !== null ? ` clip-path="url(#${this.state.clip})"` : ""
    const id = this.id("c")
    this.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"${parent}>${shape}</clipPath>`)
    this.set({ clip: id })
  }

  private put(markup: string): void {
    this.flush()
    const clip = this.state.clip
    this.body.push(clip === null ? markup : `<g clip-path="url(#${clip})">${markup}</g>`)
  }
}

export function frameMapping(windowOrigin: Point, windowExtent: Point): Mapping {
  return {
    mode: anisotropic,
    windowOrigin,
    windowExtent,
    viewportOrigin: [0, 0],
    viewportExtent: windowExtent,
    world: identity,
  }
}
