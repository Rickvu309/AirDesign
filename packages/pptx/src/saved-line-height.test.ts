import {
  decide,
  elementId,
  format,
  readRegister,
  readTextValue,
  writeTextValue,
  type Register,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { exportPackage } from "./export-package.js"
import { exportParts } from "./export-parts.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string, encoding?: "utf8"): Uint8Array & string }
  getBuiltinModule(name: "node:crypto"): {
    createHash(name: "sha256"): { update(bytes: Uint8Array): { digest(encoding: "hex"): string } }
  }
}

const fs = process.getBuiltinModule("node:fs")
const fixtures = `${process.cwd()}/scripts/pptx-fixtures`
const saved = JSON.parse(fs.readFileSync(`${fixtures}/saved-before-line-height.json`, "utf8")) as {
  readonly register: unknown
  readonly index: unknown
  readonly exported: string
}
const original = new Uint8Array(fs.readFileSync(`${fixtures}/two-templates.pptx`))

function stored(): Register {
  const read = readRegister(saved.register, saved.index)
  if (!read.ok) throw new Error(read.refusal)
  return read.value
}

async function exported(register: Register): Promise<Uint8Array> {
  const parts = await readParts(original)
  return exportPackage(
    original,
    exportParts(
      orderedParts(parts, register, () => undefined),
      register,
    ),
  )
}

function sha256(bytes: Uint8Array): string {
  return process.getBuiltinModule("node:crypto").createHash("sha256").update(bytes).digest("hex")
}

it("exports a deck the build before line height stored to the same bytes that build exported", async () => {
  expect(sha256(await exported(stored()))).toBe(saved.exported)
})

it("writes a line height set on that deck now as PowerPoint's percent line spacing", async () => {
  const register = stored()
  const value = writeTextValue([{ from: 0, lineHeight: 175_000, runs: [{ from: -1, text: "Quarterly plan" }] }])
  const decided = decide(register, {
    command: "person",
    v: format,
    patch: { text: { value: { set: value } } },
    node: elementId("256.2"),
  })
  if (decided.decision !== "apply") throw new Error(decided.code)
  const parts = await readParts(await exported(decided.register))
  const slide = decodeUtf8(parts.get("ppt/slides/slide1.xml") ?? new Uint8Array())
  expect(slide).toContain('<a:lnSpc><a:spcPct val="175000"/></a:lnSpc>')
  expect(readTextValue(value)?.[0]?.lineHeight).toBe(175_000)
})
