import { describe, expect, it } from "vitest"
import type { Doom, Write } from "./doom.js"
import { doomFromTree } from "./doom-tree.js"
import { type NodeId, rev } from "./ids.js"
import { isRefusal } from "./refusal.js"
import { land } from "./land.js"
import { measure, plainTheme, spot, words } from "./testing/doom-fixtures-art.js"
import { starts } from "./testing/start-rules.js"

const person = { kind: "person" as const, id: "p" }

function titled(name: string) {
  return doomFromTree({
    theme: plainTheme,
    name,
    slides: [
      {
        children: [
          {
            type: "shape",
            name: "title",
            props: { role: "title", box: spot(80, 60, 900, 120), text: words(starts.title.chars) },
          },
        ],
      },
    ],
  })
}

const by = { author: person, once: "o-1", measure, starts }
const deckNode = (fold: Doom) =>
  [...fold.nodes.values()].find((node) => node.type === "deck") as { id: NodeId; name: string }

describe("land", () => {
  it("lands nothing and keeps the fold when no write changes anything", () => {
    const { doom, ids } = titled("Board pack")
    const landing = land(doom, [{ node: ids.title!, prop: "text", value: words(starts.title.chars) }], by)
    if (isRefusal(landing)) throw new Error(JSON.stringify(landing))
    expect(landing.edit.writes).toEqual([])
    expect(landing.after).toBe(doom)
  })

  it("takes a write with no base as made on the fold, and refuses one whose base is older than the fold", () => {
    const { doom, ids } = titled("Board pack")
    const typed: Write = { node: ids.title!, prop: "text", value: words("Q3") }
    const landing = land(doom, [typed], by)
    if (isRefusal(landing)) throw new Error(JSON.stringify(landing))
    expect(landing.edit.writes).toEqual([typed])
    const older = rev(doom.revs.get(ids.title!)!.get("text")! - 1)
    expect(land(doom, [{ ...typed, base: older }], by)).toMatchObject({ refused: "stale" })
  })

  it("names a deck that follows its first title in the same edit, and says which writes name it", () => {
    const { doom, ids } = titled(starts.deckName)
    const landing = land(doom, [{ node: ids.title!, prop: "text", value: words("Q3 board update") }], by)
    if (isRefusal(landing)) throw new Error(JSON.stringify(landing))
    expect(landing.named.map((write) => [write.prop, write.value])).toEqual([
      ["name", "Q3 board update"],
      ["nameFollows", true],
    ])
    expect(landing.edit.writes).toEqual(expect.arrayContaining([...landing.named]))
    expect(deckNode(landing.after).name).toBe("Q3 board update")
  })

  it("stops the name following when a rename names the deck what it is already called", () => {
    const { doom } = titled("Board pack")
    const deck = deckNode(doom).id
    const following = land(doom, [{ node: deck, prop: "nameFollows", value: true }], by)
    if (isRefusal(following)) throw new Error(JSON.stringify(following))
    const landing = land(following.after, [{ node: deck, prop: "name", value: "Board pack" }], { ...by, once: "o-2" })
    if (isRefusal(landing)) throw new Error(JSON.stringify(landing))
    expect(landing.edit.writes).toEqual([{ node: deck, prop: "nameFollows", value: false }])
  })
})
