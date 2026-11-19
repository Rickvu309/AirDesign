import { expect, it } from "vitest"
import { decide, openRegister, type Register } from "./decide.js"
import { slideId } from "./element-id.js"
import { gridGroups } from "./grid-order.js"
import { readSlideNumber } from "./slide-number.js"
import { readSlideState } from "./slide-order.js"
import { readRegister } from "./stored.js"

function opened(count: number): Register {
  return { ...openRegister("", ""), file: Array.from({ length: count }, (_, i) => slideId(String(i + 256))) }
}

function stored(register: Register): unknown {
  return JSON.parse(JSON.stringify(register))
}

it("reads a register saved with the stored name row on a slide group command", () => {
  const register = opened(4)
  const edit = readSlideState({
    file: register.file,
    order: [{ slide: "add", grid: 1, row: "new", id: "300", after: "256", layout: "256" }],
  })?.order[0]
  if (edit === undefined) throw new Error("add placement was not decoded")
  const added = decide(register, { command: "slide", file: register.file, edit })
  if (added.decision !== "apply") throw new Error(added.code)
  const saved = stored(added.register)
  expect(JSON.stringify(saved)).toContain('"row":"new"')
  expect(JSON.stringify(saved)).not.toContain('"group":"new"')
  const reloaded = readRegister(saved)
  if (!reloaded.ok) throw new Error(reloaded.refusal)
  expect(gridGroups(reloaded.value)).toEqual(gridGroups(added.register))
  expect(gridGroups(reloaded.value)).toContainEqual(["300"])
})

it("reads a move saved with row keep and a slide number saved with the count row", () => {
  const state = readSlideState({
    file: ["256", "257", "258"],
    order: [{ slide: "move-many", grid: 1, ids: ["258"], after: "256", row: "keep" }],
  })
  expect(state?.order[0]).toMatchObject({ slide: "move-many", row: "keep" })
  expect(readSlideNumber({ count: "row", format: "of" })).toEqual({ count: "row", format: "of" })
})
