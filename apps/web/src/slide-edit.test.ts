import { slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { slideCommand } from "./slide-edit"

const file = [slideId("256"), slideId("257"), slideId("258")]

it("adds a slide after the current one from that slide's layout and selects it", () => {
  const built = slideCommand(file, [], "add", 1)
  expect(built?.current).toBe(2)
  expect(built?.edit).toMatchObject({ slide: "add", after: file[1], layout: file[1] })
})

it("selects a clone of the current slide", () => {
  const built = slideCommand(file, [], "clone", 0)
  expect(built?.current).toBe(1)
  expect(built?.edit).toMatchObject({ slide: "clone", source: file[0] })
})

it("refuses to delete the last slide", () => {
  expect(slideCommand([file[0]], [], "remove", 0)).toBeNull()
})

it("selects the next slide after a delete, and the previous slide when the last one goes", () => {
  expect(slideCommand(file, [], "remove", 1)).toEqual({ edit: { grid: 1, slide: "remove", id: file[1] }, current: 1 })
  expect(slideCommand(file, [], "remove", 2)).toEqual({ edit: { grid: 1, slide: "remove", id: file[2] }, current: 1 })
})

it("selects the slide a move lands on", () => {
  const built = slideCommand(file, [], "move", 2, 0)
  expect(built?.current).toBe(0)
  expect(built?.edit).toMatchObject({ slide: "move", id: file[2] })
})
