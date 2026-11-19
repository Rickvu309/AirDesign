import { decide, elementId, openRegister, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
const fixtures = `${process.cwd()}/scripts/pptx-fixtures`
const frame = elementId("256.2")

function applied(register: Register, command: Parameters<typeof decide>[1]): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

it("lays a file's frame out again in the export when the editor's register holds no index", async () => {
  const parts = await readParts(new Uint8Array(readFileSync(`${fixtures}/frame.pptx`)))
  const opened = applied(openRegister("", ""), { command: "add", node: frame, floor: "", route: "" })
  const register = applied(opened, {
    command: "person",
    v: 13,
    node: frame,
    patch: { layout: { flow: { set: "vertical" } } },
  })
  const exported = exportParts(parts, register)
  expect(decodeUtf8(exported.get("ppt/tags/tag1.xml") ?? new Uint8Array())).toContain(";f=v;")
  expect(decodeUtf8(exported.get("ppt/slides/slide1.xml") ?? new Uint8Array())).toContain(
    '<a:off x="1000000" y="2127000"/>',
  )
})
