import { expect, it } from "vitest"
import { firstShow, showKey, stepShow, type Show } from "./present-steps"

const deck = (count: number, hidden: readonly number[] = []) => ({
  count,
  hidden: Array.from({ length: count }, (_, index) => hidden.includes(index)),
})
const at = (index: number): Show => ({ ...firstShow(index), at: index })
const press = (key: string, extra: Partial<Parameters<typeof showKey>[0]> = {}) =>
  showKey({ key, metaKey: false, ctrlKey: false, altKey: false, ...extra })

it("reads the keys people present with", () => {
  for (const key of ["ArrowRight", "ArrowDown", "PageDown", " ", "n"]) expect(press(key)).toBe("next")
  for (const key of ["ArrowLeft", "ArrowUp", "PageUp"]) expect(press(key)).toBe("previous")
  expect(press("Enter")).toBe("go")
  expect(press("Backspace")).toBe("erase")
  expect(press("Home")).toBe("first")
  expect(press("End")).toBe("last")
  expect(press("Escape")).toBe("stop")
  expect(press("p")).toBe("presenter")
  expect(press("7")).toBe("7")
  expect(press("ArrowRight", { metaKey: true })).toBeNull()
  expect(press("r", { ctrlKey: true })).toBeNull()
  expect(press("x")).toBeNull()
})

it("moves forward and back one slide", () => {
  expect(stepShow(at(2), "next", deck(5))).toMatchObject({ at: 3, ended: false })
  expect(stepShow(at(2), "previous", deck(5))).toMatchObject({ at: 1 })
  expect(stepShow(at(0), "previous", deck(5))).toMatchObject({ at: 0 })
})

it("ends the deck after the last slide and leaves on the next step", () => {
  const ended = stepShow(at(4), "next", deck(5))
  expect(ended).toMatchObject({ at: 4, ended: true })
  expect(stepShow(ended as Show, "next", deck(5))).toBeNull()
  expect(stepShow(ended as Show, "previous", deck(5))).toMatchObject({ at: 4, ended: false })
})

it("skips hidden slides", () => {
  const hidden = deck(6, [2, 3, 5])
  expect(stepShow(at(1), "next", hidden)).toMatchObject({ at: 4 })
  expect(stepShow(at(4), "previous", hidden)).toMatchObject({ at: 1 })
  expect(stepShow(at(4), "next", hidden)).toMatchObject({ at: 4, ended: true })
  expect(stepShow(at(4), "last", hidden)).toMatchObject({ at: 4 })
  expect(stepShow(at(4), "first", deck(6, [0]))).toMatchObject({ at: 1 })
})

it("goes to the slide number a person types", () => {
  let show = stepShow(at(0), "1", deck(12)) as Show
  show = stepShow(show, "2", deck(12)) as Show
  expect(show.typed).toBe("12")
  expect(stepShow(show, "go", deck(12))).toMatchObject({ at: 11, typed: "", ended: false })
  expect(stepShow({ ...at(3), typed: "1" }, "erase", deck(12))).toMatchObject({ at: 3, typed: "" })
  expect(stepShow({ ...at(3), typed: "40" }, "go", deck(12))).toMatchObject({ at: 3, typed: "" })
  expect(stepShow({ ...at(3), typed: "0" }, "go", deck(12))).toMatchObject({ at: 3, typed: "" })
  expect(stepShow({ ...at(3), typed: "12" }, "3", deck(12))).toMatchObject({ typed: "12" })
})

it("shows a hidden slide a person asks for by number", () => {
  expect(stepShow({ ...at(0), typed: "3" }, "go", deck(5, [2]))).toMatchObject({ at: 2 })
})

it("steps on Enter and back on Backspace when nothing is typed", () => {
  expect(stepShow(at(1), "go", deck(5))).toMatchObject({ at: 2 })
  expect(stepShow(at(1), "erase", deck(5))).toMatchObject({ at: 0 })
})

it("clears a typed number before Esc leaves", () => {
  expect(stepShow({ ...at(1), typed: "4" }, "stop", deck(5))).toMatchObject({ at: 1, typed: "" })
  expect(stepShow(at(1), "stop", deck(5))).toBeNull()
})

it("switches between the audience and the presenter view", () => {
  const presenter = stepShow(at(1), "presenter", deck(5)) as Show
  expect(presenter.view).toBe("presenter")
  expect(stepShow(presenter, "presenter", deck(5))).toMatchObject({ view: "audience", at: 1 })
})

it("starts on the slide asked for, even a hidden one", () => {
  expect(firstShow(3)).toEqual({ at: 3, ended: false, typed: "", view: "audience" })
})
