import { scene } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { createSceneDeck } from "./scene-deck.js"
import { memorySceneRemote, type SceneRemote } from "./scene-remote.js"
import { memoryStorage } from "./scene-storage.js"

const deckNode = scene.nodeId("s:1")
const start: scene.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [{ node: deckNode, prop: "type", value: "deck" }],
}

describe("a deck reports the slide pictures its open tab painted", () => {
  it("sends the deck, the revision and the pictures to the server and returns the slides it still wants", async () => {
    const sent: unknown[] = []
    const remote: SceneRemote = {
      ...memorySceneRemote(start),
      pictures: async (body) => {
        sent.push(body)
        return { ok: true, deck: body.deck as never, missing: [scene.nodeId("s:3")] }
      },
    }
    const opened = await createSceneDeck(remote, "deck1", { storage: memoryStorage() })
    if (!opened.ok) throw new Error("open")
    const pictures = { keys: [{ slide: scene.nodeId("s:3"), key: "a".repeat(64) }], images: [] }
    expect(await opened.deck.reportPictures(1, pictures)).toEqual({ ok: true, deck: "deck1", missing: ["s:3"] })
    expect(sent).toEqual([{ deck: "deck1", rev: 1, pictures }])
  })

  it("is refused plainly when the remote takes no pictures", async () => {
    const opened = await createSceneDeck(memorySceneRemote(start), "deck1", { storage: memoryStorage() })
    if (!opened.ok) throw new Error("open")
    expect(await opened.deck.reportPictures(1, { keys: [], images: [] })).toEqual({ ok: false, refusal: "server" })
  })
})
