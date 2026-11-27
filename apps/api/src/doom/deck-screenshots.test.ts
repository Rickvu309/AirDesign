import { readDeckId, type DeckId, type SlideScreenshots } from "@airdesign/catalog"
import { screenshotsWantedMilliseconds } from "@airdesign/catalog"
import { nodeId, type NodeId } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { DeckScreenshots } from "./deck-screenshots.js"

function deckOf(name: string): DeckId {
  const read = readDeckId(name)
  if (!read.ok) throw new Error(name)
  return read.deck
}

const deck = deckOf("deck")
const first = nodeId("t:3")
const second = nodeId("t:4")
const key = (letter: string) => letter.repeat(64)
const image = (slide: NodeId, letter: string, data = "QUFB"): SlideScreenshots["images"][number] => ({
  slide,
  key: key(letter),
  type: "image/jpeg",
  data,
})

function report(keys: readonly [NodeId, string][], images: SlideScreenshots["images"] = []): SlideScreenshots {
  return { keys: keys.map(([slide, letter]) => ({ slide, key: key(letter) })), images }
}

describe("the latest screenshot of each slide, as a painter painted it", () => {
  it("names the slides it lacks, keeps a screenshot until its slide's key changes, and serves it only at that key", () => {
    const screenshots = new DeckScreenshots()
    expect(
      screenshots.keep(
        deck,
        3,
        report([
          [first, "a"],
          [second, "b"],
        ]),
      ),
    ).toEqual([first, second])
    expect(
      screenshots.keep(
        deck,
        3,
        report(
          [
            [first, "a"],
            [second, "b"],
          ],
          [image(first, "a")],
        ),
      ),
    ).toEqual([second])
    expect(
      screenshots.keep(
        deck,
        3,
        report(
          [
            [first, "a"],
            [second, "b"],
          ],
          [image(second, "b")],
        ),
      ),
    ).toEqual([])
    expect(screenshots.fresh(deck, first, key("a"))).toBe("QUFB")
    expect(screenshots.fresh(deck, first, key("z"))).toBeUndefined()
    expect(
      screenshots.keep(
        deck,
        5,
        report([
          [first, "a"],
          [second, "c"],
        ]),
      ),
    ).toEqual([second])
    expect(screenshots.fresh(deck, first, key("a"))).toBe("QUFB")
    expect(screenshots.fresh(deck, second, key("c"))).toBeUndefined()
    expect(screenshots.revision(deck)).toBe(5)
  })

  it("ignores a report older than the one it holds", () => {
    const screenshots = new DeckScreenshots()
    screenshots.keep(deck, 5, report([[first, "a"]], [image(first, "a")]))
    expect(screenshots.keep(deck, 4, report([[first, "z"]], [image(first, "z", "WldX")]))).toEqual([])
    expect(screenshots.fresh(deck, first, key("a"))).toBe("QUFB")
  })

  it("heals after a restart: a new store names every slide missing, and the tab's next report fills it", () => {
    const before = new DeckScreenshots()
    before.keep(
      deck,
      7,
      report(
        [
          [first, "a"],
          [second, "b"],
        ],
        [image(first, "a"), image(second, "b")],
      ),
    )
    const after = new DeckScreenshots()
    expect(
      after.keep(
        deck,
        7,
        report([
          [first, "a"],
          [second, "b"],
        ]),
      ),
    ).toEqual([first, second])
    expect(
      after.keep(
        deck,
        7,
        report(
          [
            [first, "a"],
            [second, "b"],
          ],
          [image(first, "a"), image(second, "b")],
        ),
      ),
    ).toEqual([])
    expect(after.fresh(deck, second, key("b"))).toBe("QUFB")
  })

  it("drops a deleted slide's screenshot and the least recently used deck past its byte cap", () => {
    const screenshots = new DeckScreenshots(12)
    const other = deckOf("other")
    screenshots.keep(
      deck,
      1,
      report(
        [
          [first, "a"],
          [second, "b"],
        ],
        [image(first, "a"), image(second, "b")],
      ),
    )
    screenshots.keep(deck, 2, report([[first, "a"]]))
    expect(screenshots.fresh(deck, second, key("b"))).toBeUndefined()
    screenshots.keep(other, 1, report([[first, "a"]], [image(first, "a", "QkJCQkJC")]))
    expect(screenshots.fresh(other, first, key("a"))).toBe("QkJCQkJC")
    screenshots.keep(deck, 2, report([[first, "a"]], [image(first, "a", "Q0NDQ0ND")]))
    expect(screenshots.fresh(other, first, key("a"))).toBeUndefined()
    expect(screenshots.fresh(deck, first, key("a"))).toBe("Q0NDQ0ND")
  })

  it("wakes a waiting read when a report lands", async () => {
    const screenshots = new DeckScreenshots()
    const waited = screenshots.wait(deck, AbortSignal.timeout(1_000))
    screenshots.keep(deck, 1, report([[first, "a"]]))
    await waited
    expect(screenshots.revision(deck)).toBe(1)
  })
})

describe("the slides an agent has asked to see", () => {
  it("wants nothing until an agent asks, then the slides it asked for, until the window passes", () => {
    let now = 1_000
    const screenshots = new DeckScreenshots(undefined, () => now)
    expect(screenshots.wantedAmong(deck, [first, second])).toEqual([])
    screenshots.want(deck, [first])
    expect(screenshots.wantedAmong(deck, [first, second])).toEqual([first])
    now += screenshotsWantedMilliseconds - 1
    screenshots.want(deck, [second])
    expect(screenshots.wantedAmong(deck, [first, second])).toEqual([first, second])
    now += screenshotsWantedMilliseconds - 1
    expect(screenshots.wantedAmong(deck, [first, second])).toEqual([first, second])
    now += 2
    expect(screenshots.wantedAmong(deck, [first, second])).toEqual([])
    screenshots.want(deck, [second])
    expect(screenshots.wantedAmong(deck, [first, second])).toEqual([second])
  })

  it("wakes a painter's lease when an agent asks, and not for another deck", async () => {
    const screenshots = new DeckScreenshots()
    const stop = new AbortController()
    let woken: boolean | undefined
    const waiting = screenshots.lease(deck, stop.signal).then((asked) => (woken = asked))
    screenshots.want(deckOf("other"), [first])
    await Promise.resolve()
    expect(woken).toBeUndefined()
    screenshots.want(deck, [first])
    expect(await waiting).toBe(true)
    const gone = new AbortController()
    const left = screenshots.lease(deck, gone.signal)
    gone.abort()
    expect(await left).toBe(false)
  })
})
