import { decide, elementId, openRegister, slideId, type Command, type Register } from "@airdesign/document"
import { paintStore } from "@airdesign/render"
import { expect, it } from "vitest"
import { busyElements, liveRepaint, shownValue } from "./live-repaint"

const node = elementId("256.2")
const other = elementId("256.3")
const box = { x: 1, y: 2, cx: 3, cy: 4 }
const dragged = { x: 9, y: 9, cx: 3, cy: 4 }
const files = new Map([
  [node, "Hello"],
  [other, "World"],
])

function landed(commands: readonly Command[]): Register {
  let register = openRegister("", "deck")
  for (const command of commands) {
    const decision = decide(register, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    register = decision.register
  }
  return register
}

const added: readonly Command[] = [
  { command: "add", node, floor: "", route: "deck" },
  { command: "add", node: other, floor: "", route: "deck" },
]

const otherEdited = landed([...added, { command: "person", node: other, value: "Agent other" }])

const edited = landed([
  ...added,
  { command: "person", node, value: "Agent" },
  { command: "person", node, property: "box", value: box },
  { command: "person", node: other, value: "Agent other" },
])

function painted() {
  const store = paintStore()
  store.publish({ id: node, kind: "shape", text: "Hello" })
  store.publish({ id: other, kind: "shape", text: "Typing" })
  return store
}

it("paints the text and box the server holds and leaves the element the person is typing in", () => {
  const store = painted()
  const busy = busyElements()
  const repaint = liveRepaint(store, files, null, busy)
  const release = busy.hold(other)
  repaint(edited)
  expect(store.getElement(node)?.text).toBe("Agent")
  expect(store.getBox(node)).toEqual(box)
  expect(store.getElement(other)?.text).toBe("Typing")
  release()
  repaint(edited)
  expect(store.getElement(other)?.text).toBe("Agent other")
})

it("paints the file text and box again when the server no longer holds an edit", () => {
  const store = painted()
  const repaint = liveRepaint(store, files, null, busyElements())
  repaint(edited)
  repaint(openRegister("", "deck"))
  expect(store.getElement(node)?.text).toBe("Hello")
  expect(store.getBox(node)).toBeNull()
})

it("leaves an element the person is dragging until the server changes that element", () => {
  const store = painted()
  const repaint = liveRepaint(store, files, null, busyElements())
  store.placeBox(node, dragged)
  repaint(otherEdited)
  expect(store.getBox(node)).toEqual(dragged)
  expect(store.getElement(other)?.text).toBe("Agent other")
  repaint(edited)
  expect(store.getBox(node)).toEqual(box)
})

it("keeps an element busy until every edit that held it lets go", () => {
  const busy = busyElements()
  const first = busy.hold(node)
  const second = busy.hold(node)
  first()
  first()
  expect(busy.has(node)).toBe(true)
  second()
  expect(busy.has(node)).toBe(false)
})

it("paints the text and box an undo gives back even though the last repaint already held them", () => {
  const store = painted()
  const repaint = liveRepaint(store, files, null, busyElements())
  store.publish({ id: node, kind: "shape", text: "Mine" })
  store.placeBox(node, dragged)
  repaint(openRegister("", "deck"))
  expect(store.getElement(node)?.text).toBe("Mine")
  expect(store.getBox(node)).toEqual(dragged)
  repaint(openRegister("", "deck"), "person")
  expect(store.getElement(node)?.text).toBe("Hello")
  expect(store.getBox(node)).toBeNull()
})

it("paints an undo the person makes while the text they just typed is still on its way to the server", () => {
  const store = painted()
  const busy = busyElements()
  const repaint = liveRepaint(store, files, null, busy)
  store.publish({ id: node, kind: "shape", text: "Mine" })
  const release = busy.hold(node)
  repaint(openRegister("", "deck"), "person")
  expect(store.getElement(node)?.text).toBe("Hello")
  release()
})

it("paints an undo of an element whose own edit is still on its way to the server", () => {
  const busy = busyElements()
  const store = painted()
  const repaint = liveRepaint(store, files, null, busy)
  busy.hold(node)
  store.publish({ id: node, kind: "shape", text: "Mine" })
  store.placeBox(node, dragged)
  repaint(openRegister("", "deck"))
  expect(store.getElement(node)?.text).toBe("Mine")
  repaint(openRegister("", "deck"), "person")
  expect(store.getElement(node)?.text).toBe("Hello")
  expect(store.getBox(node)).toBeNull()
})

it("shows the words of a text layer copied inside a group, not the empty text its file holds", () => {
  const words = '[{"from":0,"runs":[{"from":0,"text":"Label"}]}]'
  const layer = elementId("256.7")
  const register: Register = {
    ...openRegister("", "deck"),
    order: [
      {
        slide: "element-clone",
        id: slideId("256"),
        source: elementId("256.4"),
        element: { node: elementId("256.5"), kind: "group", value: null, box, grouped: false },
        layers: [
          {
            source: elementId("256.3"),
            element: { node: layer, kind: "shape", value: words, box, grouped: true, group: elementId("256.5") },
          },
        ],
      },
    ],
  }
  expect(shownValue(register, layer, "")).toBe(words)
})

it("hands back an element a repaint left while the person's edits held it, once the last of them lets go", () => {
  const store = painted()
  const freed: string[] = []
  const busy = busyElements((id) => freed.push(id))
  const repaint = liveRepaint(store, files, null, busy)
  const first = busy.hold(other)
  const second = busy.hold(other)
  repaint(edited)
  expect(store.getElement(other)?.text).toBe("Typing")
  first()
  expect(freed).toEqual([])
  second()
  expect(freed).toEqual([other])
  busy.hold(other)()
  expect(freed).toEqual([other])
})

it("paints the server's text on an element a whole repaint left while it was busy, once it is free", () => {
  const store = painted()
  const busy = busyElements()
  const release = busy.hold(other)
  const repaint = liveRepaint(store, files, edited, busy)
  expect(store.getElement(other)?.text).toBe("Typing")
  release()
  repaint(edited)
  expect(store.getElement(other)?.text).toBe("Agent other")
})
