import { expect, it } from "vitest"
import { slideKey } from "./slide-keys"

const plain = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }

it("deletes with Delete or Backspace, duplicates with the platform shortcut, and moves with alt and an arrow", () => {
  expect(slideKey({ ...plain, key: "Delete" })).toBe("remove")
  expect(slideKey({ ...plain, key: "Backspace" })).toBe("remove")
  expect(slideKey({ ...plain, key: "d", ctrlKey: true })).toBe("clone")
  expect(slideKey({ ...plain, key: "d", metaKey: true })).toBe("clone")
  expect(slideKey({ ...plain, key: "ArrowUp", altKey: true })).toBe("up")
  expect(slideKey({ ...plain, key: "ArrowDown", altKey: true })).toBe("down")
  expect(slideKey({ ...plain, key: "ArrowUp" })).toBeNull()
  expect(slideKey({ ...plain, key: "d", ctrlKey: true, shiftKey: true })).toBeNull()
})
