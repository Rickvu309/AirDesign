import { describe, expect, it } from "vitest"
import { gestureFor, gestures, type Keys, type KeyLike } from "./gestures"

const plain = { code: "", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }

function pressOf(keys: Keys): KeyLike {
  return {
    key: "key" in keys ? keys.key : "",
    code: "code" in keys ? keys.code : "",
    metaKey: keys.meta === true,
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
    expect(gestureFor({ ...plain, key: "ArrowRight", ctrlKey: true }, "element")).toBeNull()
  })

  it("takes a printed sign however the layout reaches it", () => {
    expect(gestureFor({ ...plain, key: "+", metaKey: true, shiftKey: true }, "editor")).toBe("zoom-in")
    expect(gestureFor({ ...plain, key: "=", ctrlKey: true }, "editor")).toBe("zoom-in")
    expect(gestureFor({ ...plain, key: "_", ctrlKey: true, shiftKey: true }, "editor")).toBe("zoom-out")
    expect(gestureFor({ ...plain, key: "0", ctrlKey: true, shiftKey: true }, "editor")).toBe("zoom-actual")
    expect(gestureFor({ ...plain, key: "+", shiftKey: true }, "editor")).toBe("zoom-in")
    expect(gestureFor({ ...plain, key: "-" }, "editor")).toBe("zoom-out")
  })

  it("zooms to 100% with Shift+0 or command or control and 0, as Figma does", () => {
    expect(gestureFor({ ...plain, key: ")", code: "Digit0", shiftKey: true }, "editor")).toBe("zoom-actual")
    expect(gestureFor({ ...plain, key: "=", code: "Digit0", shiftKey: true }, "editor")).toBe("zoom-actual")
    expect(gestureFor({ ...plain, key: "0", metaKey: true }, "editor")).toBe("zoom-actual")
    expect(gestureFor({ ...plain, key: "0", code: "Digit0" }, "editor")).toBeNull()
  })

  it("pans with Space alone", () => {
    expect(gestureFor({ ...plain, key: " ", code: "Space" }, "editor")).toBe("pan")
    expect(gestureFor({ ...plain, key: " ", code: "Space", shiftKey: true }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: " ", code: "Space", ctrlKey: true }, "editor")).toBeNull()
  })

  it("fits the canvas with Shift+1 and the selection with Shift+2 on any layout", () => {
    expect(gestureFor({ ...plain, key: "!", code: "Digit1", shiftKey: true }, "editor")).toBe("zoom-fit")
    expect(gestureFor({ ...plain, key: "1", code: "Digit1", shiftKey: true }, "editor")).toBe("zoom-fit")
    expect(gestureFor({ ...plain, key: "@", code: "Digit2", shiftKey: true }, "editor")).toBe("zoom-selection")
    expect(gestureFor({ ...plain, key: '"', code: "Digit2", shiftKey: true }, "editor")).toBe("zoom-selection")
    expect(gestureFor({ ...plain, key: "2", code: "Digit2" }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "@", code: "Digit2", shiftKey: true, ctrlKey: true }, "editor")).toBeNull()
  })

  it("reads the brackets and G by where they sit on the keyboard", () => {
    expect(gestureFor({ ...plain, key: "å", code: "BracketRight", ctrlKey: true }, "element")).toBe("forward")
    expect(gestureFor({ ...plain, key: "}", code: "BracketRight", ctrlKey: true, shiftKey: true }, "element")).toBe(
      "front",
    )
    expect(gestureFor({ ...plain, key: "]", code: "BracketRight" }, "element")).toBe("front")
    expect(gestureFor({ ...plain, key: "[", code: "BracketLeft" }, "element")).toBe("back")
    expect(gestureFor({ ...plain, key: "’", code: "BracketRight", metaKey: true, altKey: true }, "element")).toBe(
      "front",
    )
    expect(gestureFor({ ...plain, key: "“", code: "BracketLeft", metaKey: true, altKey: true }, "element")).toBe("back")
    expect(gestureFor({ ...plain, key: "]", code: "BracketRight", ctrlKey: true, altKey: true }, "element")).toBeNull()
    expect(gestureFor({ ...plain, key: "[", code: "BracketLeft", ctrlKey: true, altKey: true }, "element")).toBeNull()
    expect(gestureFor({ ...plain, key: "}", code: "BracketRight", shiftKey: true }, "element")).toBeNull()
    expect(gestureFor({ ...plain, key: "]", code: "BracketRight" }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "[", code: "BracketLeft" }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "G", code: "KeyG", metaKey: true, shiftKey: true }, "element")).toBe("ungroup")
  })

  it("leaves Ctrl+M alone", () => {
    const press = { key: "m", code: "KeyM", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }
    expect(gestureFor({ ...press, ctrlKey: true }, "editor")).toBeNull()
  })

  it("frames the selection with Ctrl+Alt+G or Cmd+Option+G, on a layer only", () => {
    expect(gestureFor({ ...plain, key: "g", code: "KeyG", ctrlKey: true, altKey: true }, "element")).toBe("frame")
    expect(gestureFor({ ...plain, key: "©", code: "KeyG", metaKey: true, altKey: true }, "element")).toBe("frame")
    expect(gestureFor({ ...plain, key: "g", code: "KeyG", ctrlKey: true, altKey: true }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "g", code: "KeyG", ctrlKey: true, altKey: true }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "r", code: "KeyR", ctrlKey: true, altKey: true }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "r", code: "KeyR", ctrlKey: true }, "text")).toBeNull()
  })

  it("copies, cuts and pastes layers with Figma's keys", () => {
    const keyed = (code: string, shiftKey = false) =>
      gestureFor({ ...plain, key: "", code, ctrlKey: true, shiftKey }, "editor")
    expect([keyed("KeyC"), keyed("KeyX"), keyed("KeyV")]).toEqual(["copy", "cut", "paste"])
  })

  it("moves a slide earlier or later with command or control and a bracket", () => {
    expect(gestureFor({ ...plain, key: "[", code: "BracketLeft", metaKey: true }, "slides")).toBe("slide-up")
    expect(gestureFor({ ...plain, key: "]", code: "BracketRight", ctrlKey: true }, "slides")).toBe("slide-down")
    expect(gestureFor({ ...plain, key: "}", code: "BracketRight", ctrlKey: true, shiftKey: true }, "slides")).toBeNull()
    expect(gestureFor({ ...plain, key: "]", code: "BracketRight" }, "slides")).toBeNull()
  })

  it("adds a slide with Enter in the slide list and steps between slides with the up and down keys", () => {
    expect(gestureFor({ ...plain, key: "Enter" }, "slides")).toBe("slide-add")
    expect(gestureFor({ ...plain, key: "Enter", metaKey: true }, "slides")).toBeNull()
    expect(gestureFor({ ...plain, key: "Enter" }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "ArrowUp" }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "ArrowUp" }, "slides")).toBe("slide-previous")
    expect(gestureFor({ ...plain, key: "PageUp" }, "slides")).toBe("slide-previous")
    expect(gestureFor({ ...plain, key: "ArrowDown" }, "slides")).toBe("slide-next")
    expect(gestureFor({ ...plain, key: "PageDown" }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "ArrowUp" }, "element")).toBe("nudge")
    expect(gestureFor({ ...plain, key: "ArrowUp", altKey: true }, "slides")).toBe("slide-up")
  })

  it("keeps Shift+D free and Ctrl+D as the slide duplicate shortcut", () => {
    const key = { ...plain, key: "D", shiftKey: true }
    expect(gestureFor(key, "text")).toBeNull()
    expect(gestureFor({ ...key, ctrlKey: true }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "d", ctrlKey: true }, "slides")).toBe("slide-duplicate")
  })

  it("flips horizontally with Shift+H and vertically with Shift+V on an element without switching tools", () => {
    const flipH = { ...plain, key: "H", code: "KeyH", shiftKey: true }
    const flipV = { ...plain, key: "V", code: "KeyV", shiftKey: true }
    expect(gestureFor(flipH, "element")).toBe("flip-horizontal")
    expect(gestureFor(flipV, "element")).toBe("flip-vertical")
    expect(gestureFor(flipH, "text")).toBeNull()
    expect(gestureFor(flipV, "text")).toBeNull()
    expect(gestureFor(flipH, "editor")).toBeNull()
    expect(gestureFor(flipV, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "h", code: "KeyH" }, "editor")).toBe("tool-hand")
    expect(gestureFor({ ...plain, key: "v", code: "KeyV" }, "editor")).toBe("tool-move")
  })

  it("acts only where the gesture works", () => {
    expect(gestureFor({ ...plain, key: "Delete" }, "element")).toBe("delete")
    expect(gestureFor({ ...plain, key: "Delete" }, "slides")).toBe("slide-delete")
    expect(gestureFor({ ...plain, key: "Delete" }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "Escape" }, "text")).toBe("deselect")
    expect(gestureFor({ ...plain, key: "Enter" }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "Enter", shiftKey: true }, "element")).toBe("select-parent")
    expect(gestureFor({ ...plain, key: "Enter", shiftKey: true }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "Enter", shiftKey: true }, "editor")).toBeNull()
    expect(gestureFor({ ...plain, key: "d", ctrlKey: true }, "element")).toBeNull()
  })

  it("arms the one-key tools from the slide list, as on the canvas, and keeps the slide keys there", () => {
    const tool = (key: string, code: string, shiftKey = false) =>
      gestureFor({ ...plain, key, code, shiftKey }, "slides")
    expect([
      tool("t", "KeyT"),
      tool("r", "KeyR"),
      tool("o", "KeyO"),
      tool("l", "KeyL"),
      tool("L", "KeyL", true),
    ]).toEqual(["tool-text", "tool-rectangle", "tool-ellipse", "tool-line", "tool-arrow"])
    expect(gestureFor({ ...plain, key: "d", code: "KeyD", ctrlKey: true }, "slides")).toBe("slide-duplicate")
  })

  it("selects all on the slide and all the words inside a text box", () => {
    expect(gestureFor({ ...plain, key: "a", code: "KeyA", ctrlKey: true }, "slide")).toBe("select-all")
    expect(gestureFor({ ...plain, key: "a", code: "KeyA", ctrlKey: true }, "text")).toBe("select-all")
    expect(gestureFor({ ...plain, key: "A", code: "KeyA", metaKey: true, shiftKey: true }, "text")).toBeNull()
  })

  it("reads Figma's backslash as select parent, Shift and minus as zoom out, and Mod+Backspace as ungroup", () => {
    expect(gestureFor({ ...plain, key: "\\", code: "Backslash" }, "element")).toBe("select-parent")
    expect(gestureFor({ ...plain, key: "_", code: "Minus", shiftKey: true }, "editor")).toBe("zoom-out")
    expect(gestureFor({ ...plain, key: "Backspace", metaKey: true }, "element")).toBe("ungroup")
    expect(gestureFor({ ...plain, key: "Backspace" }, "element")).toBe("delete")
  })

  it("keeps I free on a selected layer, and Ctrl or Cmd+I italic", () => {
    expect(gestureFor({ ...plain, key: "i", code: "KeyI", ctrlKey: true }, "element")).toBe("italic")
    expect(gestureFor({ ...plain, key: "i", code: "KeyI", metaKey: true }, "element")).toBe("italic")
    expect(gestureFor({ ...plain, key: "i", code: "KeyI" }, "text")).toBeNull()
    expect(gestureFor({ ...plain, key: "I", code: "KeyI", shiftKey: true }, "element")).toBeNull()
    expect(gestureFor({ ...plain, key: "i", code: "KeyI", altKey: true }, "element")).toBeNull()
  })

  it("reads Mod+Alt+R as text right", () => {
    expect(gestureFor({ ...plain, key: "®", code: "KeyR", metaKey: true, altKey: true }, "element")).toBe("text-right")
  })

  it("reads Ctrl or Cmd+P in the editor as the actions bar, as Figma's quick actions", () => {
    expect(gestureFor({ ...plain, key: "p", code: "KeyP", ctrlKey: true }, "editor")).toBe("actions")
    expect(gestureFor({ ...plain, key: "p", code: "KeyP", metaKey: true }, "editor")).toBe("actions")
    expect(gestureFor({ ...plain, key: "p", code: "KeyP" }, "editor")).toBeNull()
  })
})
