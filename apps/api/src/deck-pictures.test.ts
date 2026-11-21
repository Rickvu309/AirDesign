import { readDeckId, type DeckId, type SlidePictures } from "@airdesign/catalog"
import { slideId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { DeckPictures } from "./deck-pictures.js"

function deckOf(name: string): DeckId {
  const read = readDeckId(name)
  if (!read.ok) throw new Error(name)
  return read.deck
}

const deck = deckOf("deck")
const first = slideId("256")
const second = slideId("257")
const key = (letter: string) => letter.repeat(64)
const image = (slide: typeof first, letter: string, data = "QUFB"): SlidePictures["images"][number] => ({
  slide,
  key: key(letter),
  type: "image/jpeg",
  data,
})

function report(keys: readonly [typeof first, string][], images: SlidePictures["images"] = []): SlidePictures {
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
    expect(pictures.shot(deck, first)).toEqual({ revision: 3, data: "QUFB" })
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
    expect(pictures.shot(deck, first)).toEqual({ revision: 5, data: "QUFB" })
    expect(pictures.shot(deck, second)).toBeUndefined()
    expect(pictures.revision(deck)).toBe(5)
  })

  it("ignores a report older than the one it holds", () => {
    const pictures = new DeckPictures()
    pictures.keep(deck, 5, report([[first, "a"]], [image(first, "a")]))
    expect(pictures.keep(deck, 4, report([[first, "z"]], [image(first, "z", "WldX")]))).toEqual([])
    expect(pictures.shot(deck, first)).toEqual({ revision: 5, data: "QUFB" })
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
    expect(after.shot(deck, second)).toEqual({ revision: 7, data: "QUFB" })
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
    expect(pictures.shot(deck, second)).toBeUndefined()
    pictures.keep(other, 1, report([[first, "a"]], [image(first, "a", "QkJCQkJC")]))
    expect(pictures.shot(other, first)).toEqual({ revision: 1, data: "QkJCQkJC" })
    pictures.keep(deck, 2, report([[first, "a"]], [image(first, "a", "Q0NDQ0ND")]))
    expect(pictures.shot(other, first)).toBeUndefined()
    expect(pictures.shot(deck, first)).toEqual({ revision: 2, data: "Q0NDQ0ND" })
  })

  it("wakes a waiting read when a report lands", async () => {
    const pictures = new DeckPictures()
    const waited = pictures.wait(deck, AbortSignal.timeout(1_000))
    pictures.keep(deck, 1, report([[first, "a"]]))
    await waited
    expect(pictures.revision(deck)).toBe(1)
  })
})
