import { decide, elementId, openRegister, writeTextValue, type Register } from "@airdesign/document"
import { readParts } from "@airdesign/pptx"
import type { MeasuredFit } from "@airdesign/render"
import { expect, it } from "vitest"
import { exportedParts } from "@/exported-parts"
import { bakeFits } from "./fit-bake"

type Parts = ReadonlyMap<string, Uint8Array>

const part = "ppt/slides/slide4.xml"
const title = elementId("2727.2")
const longer = writeTextValue([
  { from: 0, runs: [{ from: 0, text: "Heat pumps move heat instead of making it, so they cut bills and emissions" }] },
])

async function doe(): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL("../../../../scripts/pptx-fixtures/doe-heat-pumps.pptx", import.meta.url)))
}

function typed(value: string): Register {
  let register = openRegister("", "")
  for (const command of [
    { command: "add", node: title, floor: "", route: "" },
    { command: "person", node: title, value },
  ] as const) {
    const decision = decide(register, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    register = decision.register
  }
  return register
}

function titleBody(parts: Parts): string {
  const xml = new TextDecoder().decode(parts.get(part))
  return xml.slice(xml.indexOf('<p:cNvPr id="2"')).match(/<a:bodyPr[^>]*>.*?<\/a:bodyPr>|<a:bodyPr[^>]*\/>/s)?.[0] ?? ""
}

const painted: MeasuredFit = { written: longer, scale: 0.775, reduction: 0.2 }

it("writes the fit the canvas painted for an edited title into the exported file, as PowerPoint saves a shrunk fit", async () => {
  const parts = await doe()
  const register = typed(longer)
  const exported = exportedParts(parts, register)
  expect(titleBody(exported)).toBe("<a:bodyPr><a:normAutofit/></a:bodyPr>")
  const baked = bakeFits(exported, register, new Map([[title, painted]]))
  expect(titleBody(baked)).toBe('<a:bodyPr><a:normAutofit fontScale="77500" lnSpcReduction="20000"/></a:bodyPr>')
  for (const [name, bytes] of exported) if (name !== part) expect(baked.get(name)).toBe(bytes)
})

it("leaves untouched text byte for byte, and a fit painted for other text than the file holds", async () => {
  const parts = await doe()
  const untouched = exportedParts(parts, openRegister("", ""))
  expect(bakeFits(untouched, openRegister("", ""), new Map([[title, painted]]))).toBe(untouched)
  const register = typed(writeTextValue([{ from: 0, runs: [{ from: 0, text: "Short" }] }]))
  const exported = exportedParts(parts, register)
  expect(bakeFits(exported, register, new Map([[title, painted]]))).toBe(exported)
})
