import { describe, expect, it } from "vitest"
import { gestureFor, gestures, type Keys, type KeyLike } from "./gestures.js"

const plain = { code: "", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }

function pressOf(keys: Keys): KeyLike {
  return {
    key: "key" in keys ? keys.key : "",
    code: "code" in keys ? keys.code : "",
    metaKey: false,
    ctrlKey: keys.mod === true || keys.ctrl === true,
    altKey: keys.alt === true,
    shiftKey: keys.shift === true,
  }
}

describe("the gesture table", () => {
  it("names each gesture once, and each has keys or a pointer", () => {
    const ids = gestures.map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(gestures.filter((row) => row.keys.length === 0 && !("pointing" in row)).map((row) => row.id)).toEqual([])
  })

  it("gives every press of a row back to that row wherever the row works", () => {
    const misread = gestures.flatMap((row) =>
      row.where.flatMap((where) =>
        row.keys.flatMap((keys: Keys) => {
          const found = gestureFor(pressOf(keys), where)
          return found === row.id ? [] : [`${row.id} in ${where} reads as ${String(found)}`]
        }),
      ),
    )
    expect(misread).toEqual([])
  })

  it("leaves every press of a row that works outside the editor to that row alone", () => {
    const shared = gestures
      .filter((row) => !(row.where as readonly string[]).includes("editor"))
      .flatMap((row) => row.keys.map((keys: Keys) => [row.id, gestureFor(pressOf(keys), "editor")] as const))
      .filter(([, found]) => found !== null)
    expect(shared).toEqual([])
  })
})

describe("gestureFor", () => {
  it("reads Cmd and Ctrl alike, and Ctrl+Y as redo only with Ctrl", () => {
    expect(gestureFor({ ...plain, key: "z", metaKey: true }, "editor")).toBe("undo")
    expect(gestureFor({ ...plain, key: "z", ctrlKey: true }, "editor")).toBe("undo")
    expect(gestureFor({ ...plain, key: "Z", metaKey: true, shiftKey: true }, "editor")).toBe("redo")
    expect(gestureFor({ ...plain, key: "y", ctrlKey: true }, "editor")).toBe("redo")
    expect(gestureFor({ ...plain, key: "y", metaKey: true }, "editor")).toBeNull()
  })

  it("matches a letter in either case and holds Shift and Alt to the row", () => {
    expect(gestureFor({ ...plain, key: "V" }, "editor")).toBe("tool-move")
    expect(gestureFor({ ...plain, key: "b", ctrlKey: true, shiftKey: true }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "z", ctrlKey: true, altKey: true }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "ArrowRight", shiftKey: true }, "element")).toBe("nudge-far")
    expect(gestureFor({ ...plain, key: "ArrowRight", altKey: true, shiftKey: true }, "element")).toBe("resize-keys")
    expect(gestureFor({ ...plain, key: "ArrowRight", ctrlKey: true }, "element")).toBeNull()
  })

  it("takes a printed sign however the layout reaches it", () => {
    expect(gestureFor({ ...plain, key: "+", metaKey: true, shiftKey: true }, "editor")).toBe("zoom-in")
    expect(gestureFor({ ...plain, key: "=", ctrlKey: true }, "editor")).toBe("zoom-in")
    expect(gestureFor({ ...plain, key: "_", ctrlKey: true, shiftKey: true }, "editor")).toBe("zoom-out")
    expect(gestureFor({ ...plain, key: "0", ctrlKey: true, shiftKey: true }, "editor")).toBe("zoom-fit")
  })

  it("reads the brackets and G by where they sit on the keyboard", () => {
    expect(gestureFor({ ...plain, key: "å", code: "BracketRight", ctrlKey: true }, "element")).toBe("forward")
    expect(gestureFor({ ...plain, key: "}", code: "BracketRight", ctrlKey: true, shiftKey: true }, "element")).toBe(
      "front",
    )
    expect(gestureFor({ ...plain, key: "G", code: "KeyG", metaKey: true, shiftKey: true }, "element")).toBe("ungroup")
  })

  it("acts only where the gesture works", () => {
    expect(gestureFor({ ...plain, key: "Delete" }, "element")).toBe("delete")
    expect(gestureFor({ ...plain, key: "Delete" }, "slides")).toBe("slide-delete")
    expect(gestureFor({ ...plain, key: "Delete" }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "Escape" }, "text")).toBe("deselect")
    expect(gestureFor({ ...plain, key: "Enter" }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "d", ctrlKey: true }, "element")).toBeNull()
  })
})
