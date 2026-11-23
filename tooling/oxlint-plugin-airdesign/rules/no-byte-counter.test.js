import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-byte-counter": "error" }
const message = "Count a value's bytes only with bytesOf from @airdesign/doom"
const source = "packages/live/src/store.ts"

const widthLoop = (name) =>
  `export function ${name}(text: string): number {\n  let size = 0\n  for (const symbol of text) {\n    const code = symbol.codePointAt(0) ?? 0\n    if (code <= 0x7f) size += 1\n    else if (code <= 0x7ff) size += 2\n    else if (code <= 0xffff) size += 3\n    else size += 4\n  }\n  return size\n}\n`

expectRejects("the engine's utf8Length fails", "packages/engine/src/call.ts", widthLoop("utf8Length"), rule, message)
expectRejects("the catalog's utf8Size fails", "packages/catalog/src/wire.ts", widthLoop("utf8Size"), rule, message)
expectRejects(
  "a width table in blocks with a decimal bound fails",
  source,
  `export function count(text: string): number {\n  let size = 0\n  for (const symbol of text) {\n    const code = symbol.codePointAt(0) ?? 0\n    if (code < 128) { size += 1 } else if (code < 2048) { size += 2 } else { size += 3 }\n  }\n  return size\n}\n`,
  rule,
  message,
)
expectRejects(
  "a width table as a conditional fails",
  source,
  `export const width = (code: number) => (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4)\n`,
  rule,
  message,
)
expectRejects(
  "the live store's textBytes fails",
  source,
  `export function textBytes(text: string): number {\n  return new TextEncoder().encode(text).length\n}\n`,
  rule,
  message,
)
expectRejects(
  "the live part's jsonBytes fails",
  "packages/live/src/part.ts",
  `function jsonBytes(value: unknown): number {\n  return new TextEncoder().encode(JSON.stringify(value)).length\n}\n`,
  rule,
  message,
)
expectRejects(
  "byteLength of an encode fails",
  source,
  `export const size = (text: string) => new TextEncoder().encode(text).byteLength\n`,
  rule,
  message,
)
expectRejects(
  "a held encoder fails",
  source,
  `const encoder = new TextEncoder()\nexport const size = (text: string) => encoder.encode(text).length\n`,
  rule,
  message,
)
expectRejects(
  "an encoder held after its use fails",
  source,
  `export const size = (text: string) => encoder.encode(text).length\nconst encoder = new TextEncoder()\n`,
  rule,
  message,
)
expectRejects(
  "a held result fails",
  source,
  `export function size(text: string): number {\n  const bytes = new TextEncoder().encode(text)\n  return bytes.byteLength\n}\n`,
  rule,
  message,
)
expectRejects(
  "a destructured length fails",
  source,
  `export function size(text: string): number {\n  const { length } = new TextEncoder().encode(text)\n  return length\n}\n`,
  rule,
  message,
)
expectRejects(
  "a cast around the encode fails",
  source,
  `export const size = (text: string) => (new TextEncoder().encode(text) as Uint8Array).length\n`,
  rule,
  message,
)
expectRejects(
  "the server's Buffer.byteLength fails",
  "apps/api/src/server.ts",
  `export const headers = (payload: string) => ({ "content-length": Buffer.byteLength(payload) })\n`,
  rule,
  message,
)
expectRejects(
  "a Buffer from text fails",
  source,
  `export const size = (text: string) => Buffer.from(text, "utf8").length\n`,
  rule,
  message,
)
expectRejects(
  "a Buffer from JSON fails",
  source,
  `export const size = (row: unknown) => Buffer.from(JSON.stringify(row)).byteLength\n`,
  rule,
  message,
)
expectRejects(
  "a Blob size fails",
  source,
  `export const size = (text: string) => new Blob([text]).size\n`,
  rule,
  message,
)
expectRejects(
  "a held Blob size fails",
  source,
  `export function size(text: string): number {\n  const blob = new Blob([text])\n  return blob.size\n}\n`,
  rule,
  message,
)
expectRejects(
  "the site counts by hand too",
  "apps/site/src/access/count.ts",
  `export const size = (text: string) => new TextEncoder().encode(text).length\n`,
  rule,
  message,
)

expectAccepts("the doom package keeps bytesOf", "packages/doom/src/limits.ts", widthLoop("bytesOf"), rule)
expectAccepts(
  "a test may check bytesOf against TextEncoder",
  "packages/live/src/live.test.ts",
  `expect(new TextEncoder().encode(value).length).toBe(8000)\nexpect(Buffer.byteLength(value)).toBe(8000)\n`,
  rule,
)
expectAccepts(
  "a spec may count",
  "tests/browser/live-cache.spec.ts",
  `export const size = (text: string) => new TextEncoder().encode(text).length\n`,
  rule,
)
expectAccepts(
  "a proof may count",
  "packages/catalog/src/wire.proof.ts",
  `export const size = (text: string) => Buffer.byteLength(text)\n`,
  rule,
)
expectAccepts(
  "bytesOf stays",
  source,
  `import { bytesOf, limits } from "@airdesign/document"\nexport const fits = (text: string) => bytesOf(text) <= limits.valueBytes\n`,
  rule,
)
expectAccepts(
  "a held encoder that only encodes stays",
  "scripts/judge-proof.mjs",
  `const encoder = new TextEncoder()\nexport const write = (parts, name, xml) => new Map(parts).set(name, encoder.encode(xml))\n`,
  rule,
)
expectAccepts(
  "the byteLength of read bytes stays",
  "apps/web/src/thin-deck.tsx",
  `export function open(bytes: Uint8Array): string {\n  const copy = new Uint8Array(bytes.byteLength)\n  copy.set(bytes)\n  return URL.createObjectURL(new Blob([copy]))\n}\n`,
  rule,
)
expectAccepts(
  "the byteLength of a wasm memory stays",
  "packages/pptx/src/element-span.ts",
  `export const have = (memory: WebAssembly.Memory) => memory.buffer.byteLength\nexport const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)\n`,
  rule,
)
expectAccepts(
  "a Buffer from bytes stays",
  "apps/api/src/local-original-store.ts",
  `export const size = (body: ArrayBuffer) => Buffer.from(body).length\n`,
  rule,
)
expectAccepts(
  "a UTF-8 encoder that writes units stays",
  "packages/pptx/src/package-bytes.ts",
  `export function units(text: string): number[] {\n  const units: number[] = []\n  for (const symbol of text) {\n    const code = symbol.codePointAt(0) ?? 0\n    if (code < 0x80) units.push(code)\n    else if (code < 0x800) units.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))\n  }\n  return units\n}\n`,
  rule,
)
expectAccepts(
  "a flag of 0x800 stays",
  "packages/pptx/src/package-container.ts",
  `export const utf8Flag = 0x800\nexport const flagged = (flags: number) => (flags & utf8Flag) !== 0\n`,
  rule,
)
expectAccepts("a string length stays", source, `export const long = (text: string) => text.length > 200\n`, rule)
expectAccepts(
  "a size of a Map stays",
  source,
  `export const count = (parts: Map<string, Uint8Array>) => parts.size\n`,
  rule,
)
expectAccepts(
  "the length of encoded bytes that are also written stays",
  "scripts/stored-zip.mjs",
  `export function entry(partName, data) {\n  const name = Buffer.from(partName, "utf8")\n  const header = Buffer.alloc(30)\n  header.writeUInt16LE(name.length, 26)\n  return Buffer.concat([header, name, data])\n}\n`,
  rule,
)
expectAccepts(
  "the length of an encoded text that is also sent stays",
  source,
  `export function send(text: string, socket: { write(bytes: Uint8Array): void }): number {\n  const bytes = new TextEncoder().encode(text)\n  socket.write(bytes)\n  return bytes.length\n}\n`,
  rule,
)
