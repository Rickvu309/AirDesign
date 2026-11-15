import { MetafileBytes, sourceBox } from "./metafile-bytes.js"
import { Playback, type Bitmap, type Frame } from "./metafile-play.js"
import { identity, nullStyle, solidBrush, type Box, type Matrix, type Point } from "./metafile-state.js"

const signature = 0x464d4520
const endRecord = 14
const screenPixelsPerMillimeter = 96 / 25.4
const copy = 0xcc0020

type Read = { readonly bytes: MetafileBytes; readonly play: Playback }

function frameOf(bytes: MetafileBytes): { frame: Frame; pixels: number } {
  const header = bytes.u32(4)
  const frame = bytes.box32(24)
  const device: Point = [bytes.i32(72), bytes.i32(76)]
  const microns = header >= 108 ? bytes.i32(100) / 1000 : 0
  const millimeters = microns > 0 ? microns : bytes.i32(80)
  const millimetersHigh = header >= 108 && bytes.i32(104) > 0 ? bytes.i32(104) / 1000 : bytes.i32(84)
  const across = device[0] > 0 && millimeters > 0 ? device[0] / millimeters : screenPixelsPerMillimeter
  const down = device[1] > 0 && millimetersHigh > 0 ? device[1] / millimetersHigh : across
  const width = ((frame.right - frame.left) / 100) * across
  const height = ((frame.bottom - frame.top) / 100) * down
  if (width > 0 && height > 0)
    return { frame: { x: (frame.left / 100) * across, y: (frame.top / 100) * down, width, height }, pixels: across }
  const bounds = bytes.box32(8)
  return {
    frame: {
      x: bounds.left,
      y: bounds.top,
      width: bounds.right - bounds.left + 1,
      height: bounds.bottom - bounds.top + 1,
    },
    pixels: across,
  }
}

function matrixAt(bytes: MetafileBytes, at: number): Matrix {
  return [
    bytes.f32(at),
    bytes.f32(at + 4),
    bytes.f32(at + 8),
    bytes.f32(at + 12),
    bytes.f32(at + 16),
    bytes.f32(at + 20),
  ]
}

function regionBoxes(bytes: MetafileBytes, at: number, size: number): Box[] {
  if (size < 32) return []
  const count = bytes.u32(at + 8)
  const boxes: Box[] = []
  for (let index = 0; index < count && 32 + (index + 1) * 16 <= size; index += 1)
    boxes.push(bytes.box32(at + 32 + index * 16))
  return boxes
}

function dest(x: number, y: number, width: number, height: number): Box {
  return { left: x, top: y, right: x + width, bottom: y + height }
}

function blit(read: Read, at: number, layout: "bit" | "stretch" | "alpha"): void {
  const { bytes, play } = read
  const target = dest(bytes.i32(at + 24), bytes.i32(at + 28), bytes.i32(at + 32), bytes.i32(at + 36))
  const operation = layout === "alpha" ? copy : bytes.u32(at + 40)
  const bitmap = bytes.bitmap(at + bytes.u32(at + 84), bytes.u32(at + 88), at + bytes.u32(at + 92), bytes.u32(at + 96))
  const width = layout === "bit" ? target.right - target.left : bytes.i32(at + 100)
  const height = layout === "bit" ? target.bottom - target.top : bytes.i32(at + 104)
  const source = dest(bytes.i32(at + 44), bytes.i32(at + 48), width, height)
  play.blit({
    dest: target,
    source: bitmap === null ? source : sourceBox(bitmap, source, false),
    bitmap: bytes.u32(at + 88) === 0 ? null : bitmap,
    operation,
    opacity: layout === "alpha" ? bytes.u8(at + 42) / 255 : 1,
  })
}

function dib(read: Read, at: number, stretched: boolean): void {
  const { bytes, play } = read
  const bitmap: Bitmap | null = bytes.bitmap(
    at + bytes.u32(at + 48),
    bytes.u32(at + 52),
    at + bytes.u32(at + 56),
    bytes.u32(at + 60),
  )
  if (bitmap === null) return
  const source = dest(bytes.i32(at + 32), bytes.i32(at + 36), bytes.i32(at + 40), bytes.i32(at + 44))
  const x = bytes.i32(at + 24)
  const y = bytes.i32(at + 28)
  const target = stretched
    ? dest(x, y, bytes.i32(at + 72), bytes.i32(at + 76))
    : dest(x, y, source.right - source.left, source.bottom - source.top)
  play.blit({
    dest: target,
    source: sourceBox(bitmap, source, true),
    bitmap,
    operation: stretched ? bytes.u32(at + 68) : copy,
    opacity: 1,
  })
}

function text(read: Read, at: number, wide: boolean): void {
  const { bytes, play } = read
  const count = bytes.u32(at + 44)
  const options = bytes.u32(at + 52)
  const words = wide ? bytes.utf16(at + bytes.u32(at + 48), count) : bytes.latin(at + bytes.u32(at + 48), count)
  const spacing = bytes.u32(at + 72)
  const paired = (options & 0x2000) !== 0
  const advances =
    spacing === 0 || !bytes.has(at + spacing, count * (paired ? 8 : 4))
      ? null
      : Array.from({ length: count }, (_, index) => bytes.i32(at + spacing + index * (paired ? 8 : 4)))
  play.text({
    reference: [bytes.i32(at + 36), bytes.i32(at + 40)],
    text: words,
    advances,
    opaque: (options & 2) !== 0 && (options & 0x100) === 0 ? bytes.box32(at + 56) : null,
  })
}

function shapes(read: Read, at: number, wide: boolean): Point[][] {
  const { bytes } = read
  const count = bytes.u32(at + 24)
  const counts = Array.from({ length: Math.min(count, bytes.bytes.length) }, (_, index) =>
    bytes.u32(at + 32 + index * 4),
  )
  let spot = at + 32 + count * 4
  return counts.map((points) => {
    const read = bytes.points(spot, points, wide)
    spot += points * (wide ? 8 : 4)
    return read
  })
}

function drawn(read: Read, type: number, at: number): void {
  const { bytes, play } = read
  const wide = type < 80
  const points = () => bytes.points(at + 28, bytes.u32(at + 24), wide)
  const point = (spot: number): Point => [bytes.i32(spot), bytes.i32(spot + 4)]
  switch (type) {
    case 2:
    case 85:
      return play.polyBezier(points())
    case 3:
    case 86:
      return play.polygon([points()])
    case 4:
    case 87:
      return play.polyline(points())
    case 5:
    case 88:
      return play.bezierTo(points())
    case 6:
    case 89:
      return play.lineTo(points())
    case 7:
    case 90:
      return shapes(read, at, wide).forEach((each) => play.polyline(each))
    case 8:
    case 91:
      return play.polygon(shapes(read, at, wide))
    case 27:
      return play.moveTo(point(at + 8))
    case 54:
      return play.lineTo([point(at + 8)])
    case 42:
      return play.ellipse(bytes.box32(at + 8))
    case 43:
      return play.rectangle(bytes.box32(at + 8))
    case 44:
      return play.roundRectangle(bytes.box32(at + 8), point(at + 24))
    case 45:
      return play.arc("arc", bytes.box32(at + 8), point(at + 24), point(at + 32))
    case 46:
      return play.arc("chord", bytes.box32(at + 8), point(at + 24), point(at + 32))
    case 47:
      return play.arc("pie", bytes.box32(at + 8), point(at + 24), point(at + 32))
  }
}

function handles(read: Read, type: number, at: number): void {
  const { bytes, play } = read
  const index = bytes.u32(at + 8)
  if (type === 38) {
    play.create(index, {
      kind: "pen",
      style: bytes.u32(at + 12),
      width: bytes.i32(at + 16),
      color: bytes.color(at + 24),
    })
  } else if (type === 95) {
    const style = bytes.u32(at + 36) === 1 ? nullStyle : bytes.u32(at + 28)
    play.create(index, { kind: "pen", style, width: bytes.i32(at + 32), color: bytes.color(at + 40) })
  } else if (type === 39) {
    play.create(index, {
      kind: "brush",
      style: bytes.u32(at + 12),
      color: bytes.color(at + 16),
      hatch: bytes.u32(at + 20),
      pattern: null,
    })
  } else if (type === 93 || type === 94) {
    const bitmap = bytes.bitmap(
      at + bytes.u32(at + 16),
      bytes.u32(at + 20),
      at + bytes.u32(at + 24),
      bytes.u32(at + 28),
    )
    play.create(
      index,
      bitmap === null ? { kind: "other" } : { ...solidBrush("gray"), style: 3, pattern: play.pattern(bitmap) },
    )
  } else if (type === 82) {
    play.create(index, bytes.font(at + 12, bytes.utf16(at + 40, 32)))
  } else if (type === 49) {
    play.create(index, { kind: "other" })
  }
}

function state(read: Read, type: number, at: number): void {
  const { bytes, play } = read
  const pair = (spot: number): Point => [bytes.i32(spot), bytes.i32(spot + 4)]
  const scaled = (extent: Point): Point => [
    (extent[0] * bytes.i32(at + 8)) / (bytes.i32(at + 12) || 1),
    (extent[1] * bytes.i32(at + 16)) / (bytes.i32(at + 20) || 1),
  ]
  const mapping = play.current.mapping
  switch (type) {
    case 9:
      return play.map({ windowExtent: pair(at + 8) })
    case 10:
      return play.map({ windowOrigin: pair(at + 8) })
    case 11:
      return play.map({ viewportExtent: pair(at + 8) })
    case 12:
      return play.map({ viewportOrigin: pair(at + 8) })
    case 17:
      return play.map({ mode: bytes.u32(at + 8) })
    case 31:
      return play.map({ viewportExtent: scaled(mapping.viewportExtent) })
    case 32:
      return play.map({ windowExtent: scaled(mapping.windowExtent) })
    case 35:
      return play.map({ world: matrixAt(bytes, at + 8) })
    case 36:
      return play.modifyWorld(matrixAt(bytes, at + 8), bytes.u32(at + 32))
    case 18:
      return play.set({ backMode: bytes.u32(at + 8) })
    case 19:
      return play.set({ fillMode: bytes.u32(at + 8) })
    case 22:
      return play.set({ align: bytes.u32(at + 8) })
    case 24:
      return play.set({ textColor: bytes.color(at + 8) })
    case 25:
      return play.set({ backColor: bytes.color(at + 8) })
    case 33:
      return play.save()
    case 34:
      return play.restore(bytes.i32(at + 8))
    case 37:
      return play.select(bytes.u32(at + 8))
    case 40:
      return play.remove(bytes.u32(at + 8))
  }
}

function paths(read: Read, type: number, at: number, size: number): void {
  const { bytes, play } = read
  switch (type) {
    case 59:
      return play.beginPath()
    case 60:
      return play.endPath()
    case 61:
      return play.closeFigure()
    case 62:
      return play.fillPath(false, true)
    case 63:
      return play.fillPath(true, true)
    case 64:
      return play.fillPath(true, false)
    case 67:
      return play.clipPath(bytes.u32(at + 8))
    case 68:
      return play.abortPath()
    case 29:
      return play.excludeBox(bytes.box32(at + 8))
    case 30:
      return play.clipBox(bytes.box32(at + 8), 1)
    case 75:
      return play.clipDevice(regionBoxes(bytes, at + 16, Math.min(bytes.u32(at + 8), size - 16)), bytes.u32(at + 12))
    case 71: {
      const brush = play.handle(bytes.u32(at + 28))
      const boxes = regionBoxes(bytes, at + 32, Math.min(bytes.u32(at + 24), size - 32))
      return brush?.kind === "brush" ? play.fillDevice(boxes, brush) : undefined
    }
    case 74:
      return play.fillDevice(regionBoxes(bytes, at + 28, Math.min(bytes.u32(at + 24), size - 28)), play.current.brush)
  }
}

export function emfSvg(source: Uint8Array): string | null {
  const bytes = new MetafileBytes(source)
  if (bytes.u32(0) !== 1 || bytes.u32(40) !== signature) return null
  const { frame, pixels } = frameOf(bytes)
  if (!(frame.width > 0 && frame.height > 0)) return null
  const play = new Playback(frame, pixels, {
    mode: 1,
    windowOrigin: [0, 0],
    windowExtent: [1, 1],
    viewportOrigin: [0, 0],
    viewportExtent: [1, 1],
    world: identity,
  })
  const read = { bytes, play }
  let at = bytes.u32(4)
  while (bytes.has(at, 8)) {
    const type = bytes.u32(at)
    const size = bytes.u32(at + 4)
    if (size < 8 || !bytes.has(at, size)) break
    if (type === endRecord) break
    if (type === 76 || type === 77) blit(read, at, type === 76 ? "bit" : "stretch")
    else if (type === 114) blit(read, at, "alpha")
    else if (type === 80 || type === 81) dib(read, at, type === 81)
    else if (type === 83 || type === 84) text(read, at, type === 84)
    else {
      drawn(read, type, at)
      handles(read, type, at)
      state(read, type, at)
      paths(read, type, at, size)
    }
    at += size
  }
  return play.svg()
}
