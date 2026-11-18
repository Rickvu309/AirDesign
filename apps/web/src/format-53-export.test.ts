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
import { readPackage } from "@airdesign/pptx"
import { beforeAll, expect, it } from "vitest"
import { deviceScope } from "./design/trait-edit"
import { exportedParts } from "./exported-parts"
import { ensureMarkup } from "./markup"

type Parts = ReadonlyMap<string, Uint8Array>
type Saved = { readonly register: unknown; readonly exported: { readonly digests: Readonly<Record<string, string>> } }

const fsName = "node:fs/promises"
const cryptoName = "node:crypto"

let saved: Saved
let parts: Parts
let digestOf: (bytes: Uint8Array) => string

beforeAll(async () => {
  const fs = (await import(fsName)) as { readFile: (path: URL, encoding?: "utf8") => Promise<Uint8Array & string> }
  const crypto = (await import(cryptoName)) as {
    createHash: (name: string) => { update: (bytes: Uint8Array) => { digest: (as: "hex") => string } }
  }
  digestOf = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16)
  saved = JSON.parse(
    await fs.readFile(new URL("../../../packages/document/src/format-53-deck.json", import.meta.url), "utf8"),
  )
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/nasa-1d-cnn.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  parts = read.parts
  await ensureMarkup()
})

function opened(): Register {
  const read = readRegister(saved.register)
  if (!read.ok) throw new Error(read.refusal)
  return read.value
}

function digests(exported: Parts): Readonly<Record<string, string>> {
  return Object.fromEntries([...exported].map(([name, bytes]) => [name, digestOf(bytes)]))
}

function landed(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    return decision.register
  }, register)
}

it("exports a deck a format 53 build saved exactly as that build exported it, every part", () => {
  expect(digests(exportedParts(parts, opened()))).toEqual(saved.exported.digests)
})

it("takes a new paint on an element an older build filled, undoes it back to that build's fill, and exports as before", () => {
  const register = opened()
  const node = elementId("382.3")
  const read = readSetChange({ op: "set", target: node, fill: { value: "accent6" } })
  if (!read.ok) throw new Error(read.field)
  const planned = planChange(read.change, deviceScope(parts, register))
  if (!planned.ok) throw new Error(planned.refusals[0]?.code)
  const [row] = planned.rows
  if (row === undefined) throw new Error("no row")
  const body = register.elements[node]
  if (body === undefined) throw new Error("no node")
  const before = beforeOf(landedPatch(body, "text"), row.row.patch)
  expect(before).toEqual({ fills: { p0: "inherit", p1: "opening", p2: "opening", p3: "opening" } })
  const painted = landed(register, [{ command: "person", node, ...row.row }])
  expect(digests(exportedParts(parts, painted))).not.toEqual(saved.exported.digests)
  const undo = undoOf(painted, { steps: [{ node, before, after: row.row.patch }] })
  if (!undo.ok) throw new Error("undo refused")
  expect(digests(exportedParts(parts, landed(painted, undo.commands)))).toEqual(saved.exported.digests)
})
