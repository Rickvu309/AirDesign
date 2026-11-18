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
    store.publish({ id, kind: "shape", text: "one" })
    store.placeBox(id, box)
    store.beginComposition(id)
    store.publish({ id, kind: "shape", text: "two" })
    store.endComposition(id, "three")
    expect(store.getBox(id)).toEqual(box)
  })

  it("holds a box placed while a gesture grips it, and lands the latest one when the gesture lets go", () => {
    const store = paintStore()
    store.placeBox(id, box)
    const grip = store.gripBox(id)
    grip.place({ ...box, x: 10 })
    store.placeBox(id, null)
    store.placeBox(id, { ...box, x: 20 })
    expect(store.getBox(id)).toEqual({ ...box, x: 10 })
    grip.release()
    expect(store.getBox(id)).toEqual({ ...box, x: 20 })
    grip.place({ ...box, x: 30 })
    expect(store.getBox(id)).toEqual({ ...box, x: 20 })
  })

  it("puts back the box from before the grip when nothing was placed meanwhile", () => {
    const store = paintStore()
    store.placeBox(id, box)
    const grip = store.gripBox(id)
    grip.place({ ...box, x: 10 })
    grip.release()
    expect(store.getBox(id)).toEqual(box)
  })

  it("keeps the gesture's box over a box placed during the grip, and places normally afterwards", () => {
    const store = paintStore()
    const grip = store.gripBox(id)
    store.placeBox(other, box)
    grip.place({ ...box, x: 10 })
    store.placeBox(id, box)
    grip.keep()
    expect(store.getBox(id)).toEqual({ ...box, x: 10 })
    expect(store.getBox(other)).toEqual(box)
    store.placeBox(id, box)
    expect(store.getBox(id)).toEqual(box)
  })

  it("gives one subscribe function per element", () => {
    const store = paintStore()
    expect(store.boxSubscribe(id)).toBe(store.boxSubscribe(id))
  })
})
