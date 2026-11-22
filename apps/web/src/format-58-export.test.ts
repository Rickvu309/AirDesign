import { readSetChange } from "@airdesign/catalog"
import {
  beforeOf,
  decide,
  elementId,
  landedPatch,
  planChange,
  readRegister,
  undoOf,
  type Command,
  type Register,
} from "@airdesign/document"
import { exportPackage, readPackage } from "@airdesign/pptx"
import { beforeAll, expect, it } from "vitest"
import { deviceScope } from "./design/trait-edit"
import { exportedParts } from "./editing/exported-parts"
import { ensureMarkup } from "./markup"

type Parts = ReadonlyMap<string, Uint8Array>
type Saved = {
  readonly register: unknown
  readonly index: unknown
  readonly exported: { readonly digests: Readonly<Record<string, string>>; readonly whole: string }
}

const fsName = "node:fs/promises"
const cryptoName = "node:crypto"

let saved: Saved
let original: Uint8Array
let parts: Parts
let sha256: (bytes: Uint8Array) => string

beforeAll(async () => {
  const fs = (await import(fsName)) as { readFile: (path: URL, encoding?: "utf8") => Promise<Uint8Array & string> }
  const crypto = (await import(cryptoName)) as {
    createHash: (name: string) => { update: (bytes: Uint8Array) => { digest: (as: "hex") => string } }
  }
  sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex")
  saved = JSON.parse(
    await fs.readFile(new URL("../../../packages/document/src/format-58-deck.json", import.meta.url), "utf8"),
  )
  original = new Uint8Array(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/connectors.pptx", import.meta.url)),
  )
  const read = await readPackage(original)
  if (!read.ok) throw new Error(read.reason)
  parts = read.parts
  await ensureMarkup()
})

function opened(): Register {
  const read = readRegister(saved.register, saved.index)
  if (!read.ok) throw new Error(read.refusal)
  return read.value
}

function digests(exported: Parts): Readonly<Record<string, string>> {
  return Object.fromEntries([...exported].map(([name, bytes]) => [name, sha256(bytes).slice(0, 16)]))
}

function landed(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    return decision.register
  }, register)
}

it("exports a deck a format 58 build saved to the same bytes that build exported, every part and the file", async () => {
  const exported = exportedParts(parts, opened())
  expect(digests(exported)).toEqual(saved.exported.digests)
  expect(sha256(await exportPackage(original, exported))).toBe(saved.exported.whole)
})

it("takes a border on a connector that build styled, undoes it to that build's border, and exports as before", () => {
  const register = opened()
  const node = elementId("256.4")
  const read = readSetChange({ op: "set", target: node, line: { width: 6, dash: "lgDash" } })
  if (!read.ok) throw new Error(read.field)
  const planned = planChange(read.change, deviceScope(parts, register))
  if (!planned.ok) throw new Error(planned.refusals[0]?.code)
  const [row] = planned.rows
  if (row === undefined) throw new Error("no row")
  expect(Object.keys(row.row.patch)).toEqual(["border"])
  const body = register.elements[node]
  if (body === undefined) throw new Error("no node")
  const before = beforeOf(landedPatch(body, "text"), row.row.patch)
  const styled = landed(register, [{ command: "person", node, ...row.row }])
  expect(digests(exportedParts(parts, styled))).not.toEqual(saved.exported.digests)
  const undo = undoOf(styled, { steps: [{ node, before, after: row.row.patch }] })
  if (!undo.ok) throw new Error("undo refused")
  expect(digests(exportedParts(parts, landed(styled, undo.commands)))).toEqual(saved.exported.digests)
})
