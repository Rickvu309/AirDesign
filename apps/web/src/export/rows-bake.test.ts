import {
  changedTable,
  decide,
  elementId,
  openRegister,
  readTableValue,
  writeTableValue,
  type Register,
} from "@airdesign/document"
import { readParts } from "@airdesign/pptx"
import type { MeasuredRows } from "@airdesign/render"
import { expect, it } from "vitest"
import { exportedParts } from "@/exported-parts"
import { bakeRows } from "./rows-bake"

type Parts = ReadonlyMap<string, Uint8Array>

const part = "ppt/slides/slide1.xml"
const table = elementId("256.4")

async function tableAdded(): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL("../../../../scripts/pptx-fixtures/table-added.pptx", import.meta.url)))
}

function typedValue(parts: Parts): string {
  const xml = new TextDecoder().decode(parts.get(part))
  const rows = [...xml.matchAll(/<a:tr /g)].length
  const start = readTableValue(
    JSON.stringify({
      rows: Array.from({ length: rows }, (_, from) => ({
        from,
        cells: [[{ from: 0, runs: [] }], [{ from: 0, runs: [] }], [{ from: 0, runs: [] }]],
      })),
    }),
  )
  if (start === null) throw new Error("table")
  return writeTableValue(changedTable(start, { change: "cell", row: 1, column: 1, text: "North\nEast\nWest" })!)
}

function typed(value: string): Register {
  let register = openRegister("", "")
  for (const command of [
    { command: "add", node: table, floor: "", route: "" },
    { command: "person", node: table, value },
  ] as const) {
    const decision = decide(register, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    register = decision.register
  }
  return register
}

function rowsOf(parts: Parts) {
  const xml = new TextDecoder().decode(parts.get(part))
  return {
    heights: [...xml.matchAll(/<a:tr h="(\d+)"/g)].map((match) => Number(match[1])),
    frame: Number(/<p:graphicFrame>.*?<a:ext cx="\d+" cy="(\d+)"/s.exec(xml)?.[1]),
  }
}

it("writes the row heights the canvas painted for an edited table, and the frame's height as their sum", async () => {
  const parts = await tableAdded()
  const value = typedValue(parts)
  const register = typed(value)
  const exported = exportedParts(parts, register)
  expect(rowsOf(exported)).toEqual({ heights: [370_840, 370_840, 370_840], frame: 1_112_520 })
  const painted: MeasuredRows = { written: value, height: 1_112_520, heights: [370_840, 660_400, 370_840] }
  const baked = bakeRows(exported, register, new Map([[table, painted]]))
  expect(rowsOf(baked)).toEqual({ heights: [370_840, 660_400, 370_840], frame: 1_402_080 })
  for (const [name, bytes] of exported) if (name !== part) expect(baked.get(name)).toBe(bytes)
})

it("leaves an untouched table byte for byte, and rows painted for other text or another frame height", async () => {
  const parts = await tableAdded()
  const value = typedValue(parts)
  const heights = [370_840, 660_400, 370_840]
  const untouched = exportedParts(parts, openRegister("", ""))
  const painted: MeasuredRows = { written: value, height: 1_112_520, heights }
  expect(bakeRows(untouched, openRegister("", ""), new Map([[table, painted]]))).toBe(untouched)
  const register = typed(value)
  const exported = exportedParts(parts, register)
  expect(bakeRows(exported, register, new Map([[table, { ...painted, written: "{}" }]]))).toBe(exported)
  expect(bakeRows(exported, register, new Map([[table, { ...painted, height: 900_000 }]]))).toBe(exported)
  expect(bakeRows(exported, register, new Map([[table, { ...painted, heights: [1, 2] }]]))).toBe(exported)
})
