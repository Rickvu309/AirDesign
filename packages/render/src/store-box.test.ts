import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { paintStore } from "./index.js"

const id = elementId("256.2")
const other = elementId("256.3")
const box = { x: 1, y: 2, cx: 3, cy: 4 }

describe("paintStore boxes", () => {
  it("has no box for an element nobody moved", () => {
    expect(paintStore().getBox(id)).toBeNull()
  })

  it("keeps a frozen copy of a placed box and tells only that element's listeners", () => {
    const store = paintStore()
    const heard: string[] = []
    store.boxSubscribe(id)(() => heard.push("moved"))
    store.boxSubscribe(other)(() => heard.push("other"))
    const placed = { ...box }
    store.placeBox(id, placed)
    placed.x = 99
    expect(store.getBox(id)).toEqual(box)
    expect(Object.isFrozen(store.getBox(id))).toBe(true)
    expect(Object.is(store.getBox(id), store.getBox(id))).toBe(true)
    expect(heard).toEqual(["moved"])
  })

  it("tells nobody when the same box is placed again", () => {
    const store = paintStore()
    store.placeBox(id, box)
    const heard: string[] = []
    store.boxSubscribe(id)(() => heard.push("moved"))
    store.placeBox(id, { ...box })
    expect(heard).toEqual([])
  })

  it("forgets a box placed back to null", () => {
    const store = paintStore()
    store.placeBox(id, box)
    const heard: string[] = []
    store.boxSubscribe(id)(() => heard.push("moved"))
    store.placeBox(id, null)
    expect(store.getBox(id)).toBeNull()
    expect(heard).toEqual(["moved"])
  })

  it("keeps the box when the element's text is published or composed", () => {
    const store = paintStore()
    store.publish({ id, kind: "shape", text: "one", picture: null })
    store.placeBox(id, box)
    store.beginComposition(id)
    store.publish({ id, kind: "shape", text: "two", picture: null })
    store.endComposition(id, "three")
    expect(store.getBox(id)).toEqual(box)
  })

  it("gives one subscribe function per element", () => {
    const store = paintStore()
    expect(store.boxSubscribe(id)).toBe(store.boxSubscribe(id))
  })
})
