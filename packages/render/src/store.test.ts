import { elementId, slideId, type Kind } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { paintStore, type ElementRecord } from "./index.js"

function shape(id: ReturnType<typeof elementId>, text: string): ElementRecord {
  return { id, kind: "shape", text }
}

describe("paintStore", () => {
  it("cached element record", () => {
    const store = paintStore()
    const keptId = elementId("1.1")
    const otherId = elementId("1.2")
    const input = shape(keptId, "one")
    expect(store.publish(input)).toEqual({ ok: true })
    expect(Object.isFrozen(input)).toBe(false)
    const first = store.getElement(keptId)
    const second = store.getElement(keptId)
    expect(first).not.toBeNull()
    expect(Object.is(first, second)).toBe(true)
    expect(Object.isFrozen(first)).toBe(true)
    expect(store.elementSubscribe(keptId)).toBe(store.elementSubscribe(keptId))

    expect(store.publish(shape(otherId, "other"))).toEqual({ ok: true })
    expect(Object.is(store.getElement(keptId), first)).toBe(true)

    expect(store.publish(shape(keptId, "next"))).toEqual({ ok: true })
    expect(store.getElement(keptId)?.text).toBe("next")
    expect(first?.text).toBe("one")
    expect(Object.is(store.getElement(keptId), first)).toBe(false)

    const pictureId = elementId("1.3")
    expect(store.publish({ id: pictureId, kind: "picture" as Kind, text: "shot" })).toEqual({
      ok: false,
      code: "kind",
    })
    expect(store.getElement(pictureId)).toBeNull()
    expect(store.publish(shape(pictureId, "shot"))).toEqual({ ok: true })
    expect(store.publish({ id: elementId("1.4"), kind: "nope" as Kind, text: "" })).toEqual({
      ok: false,
      code: "kind",
    })
  })

  it("fifty-first slide is refused", () => {
    const store = paintStore()
    const keptId = elementId("1.1")
    const keptSlide = slideId("kept-slide")
    expect(store.publish(shape(keptId, "kept"))).toEqual({ ok: true })
    expect(store.setSlides([{ id: keptSlide, elements: [keptId] }])).toEqual({ ok: true })
    const previous = store.slides()
    const previousRecord = store.getElement(keptId)
    expect(store.setSlides([{ id: keptSlide, elements: [keptId] }])).toEqual({ ok: true })
    expect(store.slides()).toBe(previous)

    const many: { id: ReturnType<typeof slideId>; elements: ReturnType<typeof elementId>[] }[] = []
    for (let index = 0; index < 51; index += 1) {
      const id = elementId(`1.${String(index + 100)}`)
      expect(store.publish(shape(id, ""))).toEqual({ ok: true })
      many.push({ id: slideId(`slide-${index}`), elements: [id] })
    }
    expect(store.setSlides(many)).toEqual({ ok: false, code: "limit" })
    expect(store.slides()).toBe(previous)
    expect(store.getElement(keptId)).toBe(previousRecord)

    expect(store.setSlides([{ id: slideId("missing-slide"), elements: [elementId("1.5")] }])).toEqual({
      ok: false,
      code: "absent",
    })
    expect(store.slides()).toBe(previous)
    expect(store.getElement(keptId)?.text).toBe("kept")
  })
})
