import { decide, elementId, openRegister, type Command, type Register } from "@airdesign/document"
import { readParts, readShapes } from "@airdesign/pptx"
import { paintStore } from "@airdesign/render"
import { expect, it } from "vitest"
import { paint } from "./deck-paint"
import { busyElements, shownValue } from "./live-repaint"
import { tableValue } from "./table-edit"

const node = elementId("256.4")

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

it("paints the rows and columns a person changed in a table the deck was imported with", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const parts = await readParts(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/table-columns.pptx", import.meta.url)),
  )
  const shape = readShapes(parts).find((each) => each.shape === "4")!
  let register = landed(openRegister("", "deck"), { command: "add", node, floor: "", route: "" })
  for (const change of [
    { change: "remove-column", column: 1 },
    { change: "remove-row", row: 0 },
  ] as const)
    register = landed(register, {
      command: "person",
      node,
      value: tableValue(parts, shape, shownValue(register, node, ""), change)!,
    })
  const painted = paint(paintStore(), parts, register, busyElements())
  const table = painted.canvases(0)?.elements.find((element) => element.id === node)?.table
  expect(table?.columns).toHaveLength(3)
  expect(table?.rows).toHaveLength(3)
})
