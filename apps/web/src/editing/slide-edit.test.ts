import { slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { slideCommand } from "./slide-edit"

const file = [slideId("256"), slideId("257"), slideId("258")]
const state = { file, order: [] }

it("adds a slide after the current one from that slide's layout and selects it", () => {
  const built = slideCommand(state, "add", 1)
  expect(built?.current).toBe(2)
  expect(built?.edit).toMatchObject({ slide: "add", after: file[1], layout: file[1] })
})

it("selects a clone of the current slide", () => {
  const built = slideCommand(state, "clone", 0)
  expect(built?.current).toBe(1)
  expect(built?.edit).toMatchObject({ slide: "clone", source: file[0] })
})

it("uses the shared fold to select a slide added below its source row", () => {
  const built = slideCommand(state, "add", 0, 0, undefined, "new")
  expect(built?.current).toBe(3)
  expect(built?.edit).toEqual({ slide: "add", grid: 1, row: "new", id: "259", after: "256", layout: "256" })
  expect(built?.edit).not.toHaveProperty("key")
})

it("refuses to delete the last slide", () => {
  expect(slideCommand({ file: [file[0]], order: [] }, "remove", 0)).toBeNull()
})

it("selects the next slide after a delete, and the previous slide when the last one goes", () => {
  expect(slideCommand(state, "remove", 1)).toEqual({ edit: { grid: 1, slide: "remove", id: file[1] }, current: 1 })
  expect(slideCommand(state, "remove", 2)).toEqual({ edit: { grid: 1, slide: "remove", id: file[2] }, current: 1 })
})

it("selects the slide a move lands on", () => {
  const built = slideCommand(state, "move", 2, 0)
  expect(built?.current).toBe(0)
  expect(built?.edit).toMatchObject({ slide: "move", id: file[2] })
})
