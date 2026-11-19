import { decide, elementId, openRegister, type Alpha, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { fadedFrames } from "./frame-fade.js"
import { shownAlphas } from "./trait-xml.js"
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

it("fades every layer of a file's frame in the export when the editor's register holds no index", async () => {
  const parts = await readParts(new Uint8Array(readFileSync(`${fixtures}/frame.pptx`)))
  const opened = applied(openRegister("", ""), { command: "add", node: frame, floor: "", route: "" })
  const register = applied(opened, {
    command: "person",
    v: 13,
    node: frame,
    patch: { layout: { opacity: { set: 50_000 as Alpha } } },
  })
  const exported = fadedFrames(exportParts(parts, register), register)
  for (const shape of ["3", "4", "5"])
    expect(shownAlphas(exported, { slide: "256", part: "ppt/slides/slide1.xml", shape }).fills).toBe(50_000)
})
