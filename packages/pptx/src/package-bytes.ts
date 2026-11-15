export function encodeUtf8(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 3)
  let at = 0
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index)
    if (code < 0x80) {
      bytes[at++] = code
      continue
    }
    const next = text.charCodeAt(index + 1)
    if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
      index += 1
    }
    if (code < 0x800) {
      bytes[at++] = 0xc0 | (code >> 6)
      bytes[at++] = 0x80 | (code & 0x3f)
    } else if (code < 0x10000) {
      bytes[at++] = 0xe0 | (code >> 12)
      bytes[at++] = 0x80 | ((code >> 6) & 0x3f)
      bytes[at++] = 0x80 | (code & 0x3f)
    } else {
      bytes[at++] = 0xf0 | (code >> 18)
      bytes[at++] = 0x80 | ((code >> 12) & 0x3f)
      bytes[at++] = 0x80 | ((code >> 6) & 0x3f)
      bytes[at++] = 0x80 | (code & 0x3f)
    }
  }
  return bytes.slice(0, at)
}

export function decodeLatin1(bytes: Uint8Array): string {
  let text = ""
  for (let index = 0; index < bytes.length; index += 4096) {
    const codes: number[] = []
    const end = Math.min(index + 4096, bytes.length)
    for (let cursor = index; cursor < end; cursor += 1) {
      const byte = bytes[cursor]
      if (byte === undefined) throw new Error("byte")
      codes.push(byte)
    }
    text += String.fromCharCode(...codes)
  }
  return text
}

export function decodeUtf8(bytes: Uint8Array): string {
  let text = ""
  const units: number[] = []
  for (let index = 0; index < bytes.length;) {
    if (units.length >= 4096) {
      text += String.fromCharCode(...units)
      units.length = 0
    }
    const first = bytes[index]
    if (first === undefined) throw new Error("byte")
    if (first < 0x80) {
      units.push(first)
      index += 1
      continue
    }
    const width = first < 0xe0 ? 2 : first < 0xf0 ? 3 : 4
    let code = first & (width === 2 ? 0x1f : width === 3 ? 0x0f : 0x07)
    for (let extra = 1; extra < width; extra += 1) {
      const next = bytes[index + extra]
      if (next === undefined || (next & 0xc0) !== 0x80) throw new Error("utf8")
      code = (code << 6) | (next & 0x3f)
    }
    if (code < 0x10000) units.push(code)
    else {
      const pair = String.fromCodePoint(code)
      units.push(pair.charCodeAt(0), pair.charCodeAt(1))
    }
    index += width
  }
  return text + String.fromCharCode(...units)
}

export function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  if (left === right) return true
  const words = left.length >>> 2
  let index = 0
  if (words > 0 && left.byteOffset % 4 === 0 && right.byteOffset % 4 === 0) {
    const leftWords = new Uint32Array(left.buffer, left.byteOffset, words)
    const rightWords = new Uint32Array(right.buffer, right.byteOffset, words)
    for (; index < words; index += 1) {
      if (leftWords[index] !== rightWords[index]) return false
    }
    index = words << 2
  }
  for (; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export function carryParts(parts: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, Uint8Array> {
  return new Map(parts)
}
