import { describe, expect, it } from "vitest"
import { paintedOnce } from "./doom-thumbnail"

function painter() {
  const painted: string[] = []
  const gate = { slides: true, running: 0, most: 0 }
  const paint = async (deck: string, rev: number) => {
    gate.running += 1
    gate.most = Math.max(gate.most, gate.running)
    await Promise.resolve()
    painted.push(`${deck}:${String(rev)}`)
    gate.running -= 1
    return gate.slides ? `<div>${deck}@${String(rev)}</div>` : null
  }
  return { painted, gate, once: paintedOnce(paint) }
}

describe("paintedOnce", () => {
  it("paints a deck once per revision and hands the same markup back", async () => {
    const { painted, once } = painter()
    const first = await once("a", 5)
    expect(await once("a", 5)).toBe(first)
    expect(painted).toEqual(["a:5"])
  })

  it("paints again when the revision moves", async () => {
    const { painted, once } = painter()
    await once("a", 5)
    await once("a", 6)
    expect(painted).toEqual(["a:5", "a:6"])
  })

  it("shares one paint between callers that ask while it runs", async () => {
    const { painted, once } = painter()
    const [first, second] = await Promise.all([once("a", 1), once("a", 1)])
    expect(first).toBe(second)
    expect(painted).toEqual(["a:1"])
  })

  it("paints one deck at a time, in the order asked", async () => {
    const { painted, gate, once } = painter()
    await Promise.all(["a", "b", "c"].map((deck) => once(deck, 1)))
    expect(painted).toEqual(["a:1", "b:1", "c:1"])
    expect(gate.most).toBe(1)
  })

  it("does not keep a deck that could not be painted", async () => {
    const { painted, gate, once } = painter()
    gate.slides = false
    expect(await once("a", 1)).toBeNull()
    gate.slides = true
    expect(await once("a", 1)).toBe("<div>a@1</div>")
    expect(painted).toEqual(["a:1", "a:1"])
  })

  it("does not stop the line when a paint throws", async () => {
    const once = paintedOnce(async (deck) => {
      if (deck === "a") throw new Error("boom")
      return "<div/>"
    })
    expect(await once("a", 1)).toBeNull()
    expect(await once("b", 1)).toBe("<div/>")
  })
})
