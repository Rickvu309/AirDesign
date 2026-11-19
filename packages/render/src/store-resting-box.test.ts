import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { paintStore } from "./index.js"

const id = elementId("256.2")
const box = { x: 1, y: 2, cx: 3, cy: 4 }

describe("paintStore resting boxes", () => {
  it("is the shown box while no gesture grips the element", () => {
    const store = paintStore()
    expect(store.getRestingBox(id)).toBeNull()
    store.placeBox(id, box)
    expect(store.getRestingBox(id)).toBe(store.getBox(id))
  })

  it("stays at the box from before the gesture while the gesture moves it, and is the moved box once kept", () => {
    const store = paintStore()
    store.placeBox(id, box)
    const before = store.getRestingBox(id)
    const grip = store.gripBox(id)
    grip.place({ ...box, x: 10 })
    grip.place({ ...box, x: 20 })
    expect(store.getBox(id)).toEqual({ ...box, x: 20 })
    expect(store.getRestingBox(id)).toBe(before)
    const heard: unknown[] = []
    store.boxSubscribe(id)(() => heard.push(store.getRestingBox(id)))
    grip.keep()
    expect(heard).toEqual([{ ...box, x: 20 }])
    expect(store.getRestingBox(id)).toBe(store.getBox(id))
  })

  it("follows a box placed during the gesture and tells the listeners, then rests there on release", () => {
    const store = paintStore()
    store.placeBox(id, box)
    const grip = store.gripBox(id)
    grip.place({ ...box, x: 10 })
    const heard: unknown[] = []
    store.boxSubscribe(id)(() => heard.push(store.getRestingBox(id)))
    store.placeBox(id, { ...box, x: 30 })
    expect(heard).toEqual([{ ...box, x: 30 }])
    expect(store.getBox(id)).toEqual({ ...box, x: 10 })
    grip.release()
    expect(store.getRestingBox(id)).toEqual({ ...box, x: 30 })
    expect(store.getBox(id)).toBe(store.getRestingBox(id))
  })
})
