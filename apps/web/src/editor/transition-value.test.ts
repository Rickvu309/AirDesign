import { expect, it } from "vitest"
import { sharedArrival } from "./transition-value"

const dissolve = { state: "value", value: { dissolve: { duration: 500, advance: { click: true } } } } as const
const push = {
  state: "value",
  value: { push: { direction: "left", duration: 500, advance: { click: true } } },
} as const

it("shows the one transition every selected slide shares", () => {
  expect(sharedArrival([dissolve, { ...dissolve }])).toEqual(dissolve)
})

it("calls the selection Mixed when its slides arrive differently", () => {
  expect(sharedArrival([dissolve, push])).toBe("mixed")
  expect(sharedArrival([dissolve, { state: "kept" }])).toBe("mixed")
})

it("keeps a file's own transition when every selected slide keeps one", () => {
  expect(sharedArrival([{ state: "kept" }, { state: "kept" }])).toEqual({ state: "kept" })
})
