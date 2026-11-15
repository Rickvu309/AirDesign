import { bitmapInfoBytes } from "./bitmap-file.js"
import { MetafileBytes, sourceBox } from "./metafile-bytes.js"
import { frameMapping, Playback, type Frame } from "./metafile-play.js"
import { solidBrush, type Box, type Mapping, type Point } from "./metafile-state.js"

const placeableKey = 0x9ac6cdd7
const screenPixelsPerMillimeter = 96 / 25.4

type Read = { readonly bytes: MetafileBytes; readonly play: Playback }

function box16(bytes: MetafileBytes, at: number): Box {
  return { left: bytes.i16(at + 6), top: bytes.i16(at + 4), right: bytes.i16(at + 2), bottom: bytes.i16(at) }
}

function pair(bytes: MetafileBytes, at: number): Point {
  return [bytes.i16(at + 2), bytes.i16(at)]
}

function windowOf(bytes: MetafileBytes, start: number): { origin: Point; extent: Point } | null {
  let origin: Point = [0, 0]
  for (let at = start; bytes.has(at, 6);) {
    const size = bytes.u32(at) * 2
    const type = bytes.u16(at + 4)
    if (size < 6 || type === 0) return null
    if (type === 0x020b) origin = pair(bytes, at + 6)
    if (type === 0x020c) return { origin, extent: pair(bytes, at + 6) }
    at += size
  }
  return null
}

function dib(read: Read, at: number, end: number, place: { target: Box; source: Box; operation: number }): void {
  const { bytes, play } = read
  const info = bitmapInfoBytes(bytes.bytes.subarray(at, end))
  const bitmap = info === null ? null : bytes.bitmap(at, info, at + info, end - at - info)
  if (bitmap === null) return
  play.blit({
    dest: place.target,
    source: sourceBox(bitmap, place.source, true),
    bitmap,
    operation: place.operation,
    opacity: 1,
  })
}

function spanned(x: number, y: number, width: number, height: number): Box {
  return { left: x, top: y, right: x + width, bottom: y + height }
}

function bitmaps(read: Read, type: number, at: number, end: number): void {
  const { bytes, play } = read
  const word = (index: number) => bytes.i16(at + 6 + index * 2)
  const operation = bytes.u32(at + 6)
  const bare = end - at === ((type >> 8) + 3) * 2
  if (type === 0x0b41) {
    if (bare)
      return play.blit({
        dest: spanned(word(10), word(9), word(8), word(7)),
        source: spanned(0, 0, 0, 0),
        bitmap: null,
        operation,
        opacity: 1,
      })
    return dib(read, at + 26, end, {
      target: spanned(word(9), word(8), word(7), word(6)),
      source: spanned(word(5), word(4), word(3), word(2)),
      operation,
    })
  }
  if (type === 0x0940) {
    if (bare)
      return play.blit({
        dest: spanned(word(8), word(7), word(6), word(5)),
        source: spanned(0, 0, 0, 0),
        bitmap: null,
        operation,
        opacity: 1,
      })
    return dib(read, at + 22, end, {
      target: spanned(word(7), word(6), word(5), word(4)),
      source: spanned(word(3), word(2), word(5), word(4)),
      operation,
    })
  }
  if (type === 0x0f43)
    return dib(read, at + 28, end, {
      target: spanned(word(10), word(9), word(8), word(7)),
      source: spanned(word(6), word(5), word(4), word(3)),
      operation,
    })
  if (type === 0x0d33)
    return dib(read, at + 24, end, {
      target: spanned(word(8), word(7), word(6), word(5)),
      source: spanned(word(4), word(3), word(6), word(5)),
      operation: 0xcc0020,
    })
  if (type === 0x061d)
    return play.blit({
      dest: spanned(word(5), word(4), word(3), word(2)),
      source: spanned(0, 0, 0, 0),
      bitmap: null,
      operation,
      opacity: 1,
    })
}

function text(read: Read, type: number, at: number, end: number): void {
  const { bytes, play } = read
  if (type !== 0x0521 && type !== 0x0a32) return
  if (type === 0x0521) {
    const count = bytes.i16(at + 6)
    const after = at + 8 + count + (count % 2)
    play.text({ reference: pair(bytes, after), text: bytes.latin(at + 8, count), advances: null, opaque: null })
    return
  }
  const count = bytes.i16(at + 10)
  const options = bytes.u16(at + 12)
  const boxed = (options & 6) !== 0
  const words = at + 14 + (boxed ? 8 : 0)
  const spacing = words + count + (count % 2)
  const advances =
    spacing + count * 2 <= end ? Array.from({ length: count }, (_, index) => bytes.i16(spacing + index * 2)) : null
  play.text({
    reference: pair(bytes, at + 6),
    text: bytes.latin(words, count),
    advances,
    opaque:
      boxed && (options & 2) !== 0
        ? { left: bytes.i16(at + 14), top: bytes.i16(at + 16), right: bytes.i16(at + 18), bottom: bytes.i16(at + 20) }
        : null,
  })
}

function handles(read: Read, type: number, at: number, end: number): void {
  const { bytes, play } = read
  const made = () => play.freeIndex()
  if (type === 0x02fa)
    play.create(made(), {
      kind: "pen",
      style: bytes.u16(at + 6),
      width: bytes.i16(at + 8),
      color: bytes.color(at + 12),
    })
  else if (type === 0x02fc)
    play.create(made(), {
      kind: "brush",
      style: bytes.u16(at + 6),
      color: bytes.color(at + 8),
      hatch: bytes.u16(at + 12),
      pattern: null,
    })
  else if (type === 0x02fb)
    play.create(made(), {
      kind: "font",
      height: bytes.i16(at + 6),
      escapement: bytes.i16(at + 10),
      weight: bytes.i16(at + 14),
      italic: bytes.u8(at + 16) !== 0,
      underline: bytes.u8(at + 17) !== 0,
      strike: bytes.u8(at + 18) !== 0,
      family: bytes.u8(at + 23),
      face: bytes.latin(at + 24, 32).split("\u0000")[0] ?? "",
    })
  else if (type === 0x0142) {
    const info = bitmapInfoBytes(bytes.bytes.subarray(at + 10, end))
    const bitmap = info === null ? null : bytes.bitmap(at + 10, info, at + 10 + info, end - at - 10 - info)
    play.create(
      made(),
      bitmap === null ? { kind: "other" } : { ...solidBrush("gray"), style: 3, pattern: play.pattern(bitmap) },
    )
  } else if (type === 0x01f9 || type === 0x00f7 || type === 0x06ff) play.create(made(), { kind: "other" })
}

function mapped(read: Read, type: number, at: number): void {
  const { bytes, play } = read
  const current: Mapping = play.current.mapping
  const point = pair(bytes, at + 6)
  const scaled = (extent: Point): Point => [
    (extent[0] * bytes.i16(at + 12)) / (bytes.i16(at + 10) || 1),
    (extent[1] * bytes.i16(at + 8)) / (bytes.i16(at + 6) || 1),
  ]
  if (type === 0x020b) play.map({ windowOrigin: point })
  else if (type === 0x020c) play.map({ windowExtent: point })
  else if (type === 0x020d) play.map({ viewportOrigin: point })
  else if (type === 0x020e) play.map({ viewportExtent: point })
  else if (type === 0x020f)
    play.map({ windowOrigin: [current.windowOrigin[0] + point[0], current.windowOrigin[1] + point[1]] })
  else if (type === 0x0211)
    play.map({ viewportOrigin: [current.viewportOrigin[0] + point[0], current.viewportOrigin[1] + point[1]] })
  else if (type === 0x0410) play.map({ windowExtent: scaled(current.windowExtent) })
  else if (type === 0x0412) play.map({ viewportExtent: scaled(current.viewportExtent) })
}

function settings(read: Read, type: number, at: number): void {
  const { bytes, play } = read
  if (type === 0x001e) play.save()
  else if (type === 0x0127) play.restore(bytes.i16(at + 6))
  else if (type === 0x0102) play.set({ backMode: bytes.u16(at + 6) })
  else if (type === 0x0106) play.set({ fillMode: bytes.u16(at + 6) })
  else if (type === 0x012e) play.set({ align: bytes.u16(at + 6) })
  else if (type === 0x0201) play.set({ backColor: bytes.color(at + 6) })
  else if (type === 0x0209) play.set({ textColor: bytes.color(at + 6) })
  else if (type === 0x012d) play.select(bytes.u16(at + 6))
  else if (type === 0x01f0) play.remove(bytes.u16(at + 6))
  else if (type === 0x0416) play.clipBox(box16(bytes, at + 6), 1)
  else if (type === 0x0415) play.excludeBox(box16(bytes, at + 6))
  else if (type === 0x012c) play.set({ clip: null })
}

function shapes(read: Read, type: number, at: number): void {
  const { bytes, play } = read
  const corner = (spot: number): Point => pair(bytes, spot)
  if (type === 0x0213) play.lineTo([pair(bytes, at + 6)])
  else if (type === 0x0214) play.moveTo(pair(bytes, at + 6))
  else if (type === 0x0324) play.polygon([bytes.points(at + 8, bytes.i16(at + 6), false)])
  else if (type === 0x0325) play.polyline(bytes.points(at + 8, bytes.i16(at + 6), false))
  else if (type === 0x0538) {
    const count = bytes.u16(at + 6)
    let spot = at + 8 + count * 2
    const shapes: Point[][] = []
    for (let index = 0; index < count; index += 1) {
      const points = bytes.u16(at + 8 + index * 2)
      shapes.push(bytes.points(spot, points, false))
      spot += points * 4
    }
    play.polygon(shapes)
  } else if (type === 0x041b) play.rectangle(box16(bytes, at + 6))
  else if (type === 0x0418) play.ellipse(box16(bytes, at + 6))
  else if (type === 0x061c) play.roundRectangle(box16(bytes, at + 10), corner(at + 6))
  else if (type === 0x0817 || type === 0x081a || type === 0x0830) {
    const kind = type === 0x0817 ? "arc" : type === 0x081a ? "pie" : "chord"
    play.arc(kind, box16(bytes, at + 14), corner(at + 10), corner(at + 6))
  }
}

export function wmfSvg(source: Uint8Array): string | null {
  const bytes = new MetafileBytes(source)
  const placeable = bytes.u32(0) === placeableKey
  const base = placeable ? 22 : 0
  const kind = bytes.u16(base)
  if ((kind !== 1 && kind !== 2) || bytes.u16(base + 2) !== 9) return null
  const start = base + 18
  let frame: Frame
  let mapping: Mapping
  let pixels = screenPixelsPerMillimeter
  if (placeable) {
    const [left, top, right, bottom] = [bytes.i16(6), bytes.i16(8), bytes.i16(10), bytes.i16(12)]
    frame = { x: 0, y: 0, width: Math.abs(right - left), height: Math.abs(bottom - top) }
    mapping = frameMapping([Math.min(left, right), Math.min(top, bottom)], [frame.width, frame.height])
    pixels = bytes.u16(14) > 0 ? bytes.u16(14) / 25.4 : pixels
  } else {
    const window = windowOf(bytes, start)
    if (window === null || window.extent[0] === 0 || window.extent[1] === 0) return null
    frame = { x: 0, y: 0, width: Math.abs(window.extent[0]), height: Math.abs(window.extent[1]) }
    mapping = { ...frameMapping(window.origin, window.extent), viewportExtent: [frame.width, frame.height] }
  }
  if (!(frame.width > 0 && frame.height > 0)) return null
  const play = new Playback(frame, pixels, mapping)
  const read = { bytes, play }
  for (let at = start; bytes.has(at, 6);) {
    const size = bytes.u32(at) * 2
    const type = bytes.u16(at + 4)
    if (type === 0 || size < 6 || !bytes.has(at, size)) break
    const end = at + size
    bitmaps(read, type, at, end)
    text(read, type, at, end)
    handles(read, type, at, end)
    mapped(read, type, at)
    settings(read, type, at)
    shapes(read, type, at)
    at = end
  }
  return play.svg()
}
