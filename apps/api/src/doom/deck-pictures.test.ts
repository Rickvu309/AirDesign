import { readDeckId, type DeckId, type SlidePictures } from "@airdesign/catalog"
import { picturesWantedMilliseconds } from "@airdesign/catalog"
import { nodeId, type NodeId } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { DeckPictures, watchGrace } from "./deck-pictures.js"

function deckOf(name: string): DeckId {
  const read = readDeckId(name)
  if (!read.ok) throw new Error(name)
  return read.deck
}

const deck = deckOf("deck")
const first = nodeId("t:3")
const second = nodeId("t:4")
const key = (letter: string) => letter.repeat(64)
const image = (slide: NodeId, letter: string, data = "QUFB"): SlidePictures["images"][number] => ({
  slide,
  key: key(letter),
  type: "image/jpeg",
  data,
})

function report(keys: readonly [NodeId, string][], images: SlidePictures["images"] = []): SlidePictures {
  return { keys: keys.map(([slide, letter]) => ({ slide, key: key(letter) })), images }
}

describe("the latest picture of each slide, as the open tab painted it", () => {
  it("names the slides it lacks, keeps a picture until its slide's key changes, and serves it only at that key", () => {
    const pictures = new DeckPictures()
    expect(
      pictures.keep(
        deck,
        3,
        report([
          [first, "a"],
          [second, "b"],
        ]),
      ),
    ).toEqual([first, second])
    expect(
      pictures.keep(
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
      pictures.keep(
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
    expect(pictures.fresh(deck, first, key("a"))).toBe("QUFB")
    expect(pictures.fresh(deck, first, key("z"))).toBeUndefined()
    expect(
      pictures.keep(
        deck,
        5,
        report([
          [first, "a"],
          [second, "c"],
        ]),
      ),
    ).toEqual([second])
    expect(pictures.fresh(deck, first, key("a"))).toBe("QUFB")
    expect(pictures.fresh(deck, second, key("c"))).toBeUndefined()
    expect(pictures.revision(deck)).toBe(5)
  })

  it("ignores a report older than the one it holds", () => {
    const pictures = new DeckPictures()
    pictures.keep(deck, 5, report([[first, "a"]], [image(first, "a")]))
    expect(pictures.keep(deck, 4, report([[first, "z"]], [image(first, "z", "WldX")]))).toEqual([])
    expect(pictures.fresh(deck, first, key("a"))).toBe("QUFB")
  })

  it("heals after a restart: a new store names every slide missing, and the tab's next report fills it", () => {
    const before = new DeckPictures()
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
    const after = new DeckPictures()
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

  it("drops a deleted slide's picture and the least recently used deck past its byte cap", () => {
    const pictures = new DeckPictures(12)
    const other = deckOf("other")
    pictures.keep(
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
    pictures.keep(deck, 2, report([[first, "a"]]))
    expect(pictures.fresh(deck, second, key("b"))).toBeUndefined()
    pictures.keep(other, 1, report([[first, "a"]], [image(first, "a", "QkJCQkJC")]))
    expect(pictures.fresh(other, first, key("a"))).toBe("QkJCQkJC")
    pictures.keep(deck, 2, report([[first, "a"]], [image(first, "a", "Q0NDQ0ND")]))
    expect(pictures.fresh(other, first, key("a"))).toBeUndefined()
    expect(pictures.fresh(deck, first, key("a"))).toBe("Q0NDQ0ND")
  })

  it("wakes a waiting read when a report lands", async () => {
    const pictures = new DeckPictures()
    const waited = pictures.wait(deck, AbortSignal.timeout(1_000))
    pictures.keep(deck, 1, report([[first, "a"]]))
    await waited
    expect(pictures.revision(deck)).toBe(1)
  })
})

describe("the slides an agent has asked to see", () => {
  it("wants nothing until an agent asks, then the slides it asked for, until the window passes", () => {
    let now = 1_000
    const pictures = new DeckPictures(undefined, () => now)
    expect(pictures.wantedAmong(deck, [first, second])).toEqual([])
    pictures.want(deck, [first])
    expect(pictures.wantedAmong(deck, [first, second])).toEqual([first])
    now += picturesWantedMilliseconds - 1
    pictures.want(deck, [second])
    expect(pictures.wantedAmong(deck, [first, second])).toEqual([first, second])
    now += picturesWantedMilliseconds - 1
    expect(pictures.wantedAmong(deck, [first, second])).toEqual([first, second])
    now += 2
    expect(pictures.wantedAmong(deck, [first, second])).toEqual([])
    pictures.want(deck, [second])
    expect(pictures.wantedAmong(deck, [first, second])).toEqual([second])
  })

  it("wakes the tab's held catch-up when an agent asks, and not for another deck", async () => {
    const pictures = new DeckPictures()
    const stop = new AbortController()
    let woken: boolean | undefined
    const waiting = pictures.asked(deck, stop.signal).then((asked) => (woken = asked))
    pictures.want(deckOf("other"), [first])
    await Promise.resolve()
    expect(woken).toBeUndefined()
    pictures.want(deck, [first])
    expect(await waiting).toBe(true)
    const gone = new AbortController()
    const left = pictures.asked(deck, gone.signal)
    gone.abort()
    expect(await left).toBe(false)
  })
})

describe("whether an open tab watches a deck", () => {
  it("knows no tab until one follows the deck or sends pictures, and for a few seconds after it stops", () => {
    let now = 1_000
    const pictures = new DeckPictures(undefined, () => now)
    expect(pictures.watched(deck)).toBe(false)
    const following = new AbortController()
    void pictures.asked(deck, following.signal)
    now += 60_000
    expect(pictures.watched(deck)).toBe(true)
    following.abort()
    now += watchGrace - 1
    expect(pictures.watched(deck)).toBe(true)
    now += 1
    expect(pictures.watched(deck)).toBe(false)
    pictures.keep(deck, 3, report([[first, "a"]]))
    expect(pictures.watched(deck)).toBe(true)
    expect(pictures.watched(deckOf("other"))).toBe(false)
  })
})
