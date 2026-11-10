import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js"

export function encodeUtf8(text: string): Uint8Array {
  const units: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index)
    const next = text.charCodeAt(index + 1)
    if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
      index += 1
    }
    if (code < 0x80) units.push(code)
    else if (code < 0x800) units.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) units.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else
      units.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return Uint8Array.from(units)
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
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index]
    if (first === undefined) throw new Error("byte")
    if (first < 0x80) {
      text += String.fromCharCode(first)
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
    text += String.fromCodePoint(code)
    index += width
  }
  return text
}

export async function readParts(bytes: Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  const reader = new ZipReader(new Uint8ArrayReader(bytes))
  const entries = await reader.getEntries()
  const parts = new Map<string, Uint8Array>()
  for (const entry of entries) {
    if (entry.directory) continue
    parts.set(entry.filename, await entry.getData(new Uint8ArrayWriter()))
  }
  await reader.close()
  return parts
}

const packageDate = new Date(Date.UTC(1980, 0, 1))

export async function writeParts(parts: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter(), { lastModDate: packageDate })
  for (const [name, data] of parts) {
    await writer.add(name, new Uint8ArrayReader(data), { lastModDate: packageDate })
  }
  return writer.close()
}

export function carryParts(parts: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, Uint8Array> {
  return new Map(parts)
}

export async function roundTripPackage(bytes: Uint8Array): Promise<Uint8Array> {
  return writeParts(carryParts(await readParts(bytes)))
}
