import { describe, expect, it } from "vitest"
import { slideId } from "./element-id.js"
import { orderKeyBetween } from "./order-key.js"
import { foldSlides, presentSlides, type SlideState } from "./slide-order.js"
import { slidesKept } from "./slide-kept.js"

const file = [slideId("256"), slideId("257"), slideId("258")]

function present(state: SlideState): string[] {
  return presentSlides(state).map((spot) => spot.id)
}

describe("slides kept", () => {
  it("removes every present slide outside the chosen positions and keeps the rest in their order", () => {
    const kept = slidesKept({ file, order: [] }, [2, 0])
    expect(present(kept)).toEqual(["256", "258"])
    expect(kept.order).toEqual([{ slide: "remove", id: "257" }])
  })

  it("counts positions over present slides after adds, moves and removes", () => {
    const state: SlideState = {
      file,
      order: [
        { slide: "remove", id: slideId("256") },
        {
          slide: "add",
          id: slideId("259"),
          after: slideId("258"),
          key: orderKeyBetween(null, null),
          layout: slideId("258"),
        },
      ],
    }
    expect(present(state)).toEqual(["259", "257", "258"])
    const kept = slidesKept(state, [0])
    expect(present(kept)).toEqual(["259"])
    expect(
      foldSlides(kept)
        .filter((spot) => !spot.present)
        .map((spot) => spot.id),
    ).toEqual(["256", "257", "258"])
  })

  it("leaves the state alone when every slide is chosen and keeps the other fields", () => {
    const state = { file, order: [], name: "deck" }
    expect(slidesKept(state, [0, 1, 2])).toBe(state)
  })

  it("ignores positions past the last slide and refuses to keep no slide", () => {
    expect(present(slidesKept({ file, order: [] }, [1, 9]))).toEqual(["257"])
    expect(() => slidesKept({ file, order: [] }, [9])).toThrow("slides")
  })
})
