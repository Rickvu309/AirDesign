import { expect, it } from "vitest"
import { undoKey } from "./undo-keys"

const plain = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, typing: false }

it("undoes with the platform shortcut and redoes with shift or Ctrl+Y", () => {
  expect(undoKey({ ...plain, key: "z", ctrlKey: true })).toBe("undo")
  expect(undoKey({ ...plain, key: "z", metaKey: true })).toBe("undo")
  expect(undoKey({ ...plain, key: "Z", metaKey: true, shiftKey: true })).toBe("redo")
  expect(undoKey({ ...plain, key: "z", ctrlKey: true, shiftKey: true })).toBe("redo")
  expect(undoKey({ ...plain, key: "y", ctrlKey: true })).toBe("redo")
})

it("leaves the keys to the browser while a person types, and ignores other keys", () => {
  expect(undoKey({ ...plain, key: "z", ctrlKey: true, typing: true })).toBeNull()
  expect(undoKey({ ...plain, key: "z" })).toBeNull()
  expect(undoKey({ ...plain, key: "z", ctrlKey: true, altKey: true })).toBeNull()
  expect(undoKey({ ...plain, key: "y", metaKey: true })).toBeNull()
})
