import { expect, it } from "vitest"
import { presentKey } from "./present-keys"

const key = (value: string, extra: Partial<Parameters<typeof presentKey>[0]> = {}) =>
  presentKey({ key: value, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, field: false, ...extra })

it("presents from the first slide on F5 and from the current one on Shift+F5", () => {
  expect(key("F5")).toBe("first")
  expect(key("F5", { shiftKey: true })).toBe("current")
  expect(key("F5", { field: true })).toBe("first")
})

it("presents from the current slide on Cmd or Ctrl+Enter outside a text field", () => {
  expect(key("Enter", { metaKey: true })).toBe("current")
  expect(key("Enter", { ctrlKey: true })).toBe("current")
  expect(key("Enter", { metaKey: true, field: true })).toBeNull()
  expect(key("Enter")).toBeNull()
})

it("presents from the current slide on Figma's Cmd or Ctrl+Alt+Enter", () => {
  expect(key("Enter", { metaKey: true, altKey: true })).toBe("current")
  expect(key("Enter", { ctrlKey: true, altKey: true })).toBe("current")
  expect(key("Enter", { altKey: true })).toBeNull()
})
