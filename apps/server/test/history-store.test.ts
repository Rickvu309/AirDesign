import { describe, it, expect } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { createHistoryStore } from "../src/db/history-store.ts"
import { commandId, initialHistory, type Command, type History } from "../../../packages/change-log/src/index.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
const owner = { personId: "owner" }, stranger = { personId: "stranger" }
const cid = commandId
function edit(request: string, history: History, text: string): Extract<Command, { kind: "edit" }> {
  const slide = history.deck.slides[0]
  if (!slide) throw new Error("fixture-slide")
  return { id: cid(request), kind: "edit", base: history.seq, run: null, changes: { changes: [{ kind: "set", target: slide.id, value: { ...slide, notes: text } }] } }
}
describe("transactional history adapter", () => {
  it("serializes parallel database delivery, immutable retries and restart on disk", async () => {
    const folder = await mkdtemp(path.join(os.homedir(),"tmp/p04-history-"))
    let store = await createHistoryStore({kind:"pglite",path:folder})
    try {
      const deck = fixtureDeck(2)
      await store.create(owner,deck)
      const command = edit("once",initialHistory(deck),"durable")
      const receipts = await Promise.all([store.commit(owner,deck.id,command),store.commit(owner,deck.id,command)])
      expect(receipts[0]).toEqual(receipts[1])
      expect((await store.replay(owner,deck.id,0)).events).toHaveLength(1)
      await expect(store.commit(owner,deck.id,{...command,base:999})).rejects.toThrow("request-id-payload-mismatch")
      for (const call of [()=>store.read(stranger,deck.id),()=>store.commit(stranger,deck.id,command),()=>store.replay(stranger,deck.id,0),()=>store.delete(stranger,deck.id)]) await expect(call()).rejects.toThrow("deck-not-found")
      await store.close()
      store = await createHistoryStore({kind:"pglite",path:folder})
      expect(await store.commit(owner,deck.id,command)).toEqual(receipts[0])
      expect((await store.read(owner,deck.id)).deck.slides[0]?.notes).toBe("durable")
      const undone = await Promise.all([store.commit(owner,deck.id,{id:cid("undo1"),kind:"undo",target:command.id}),store.commit(owner,deck.id,{id:cid("undo2"),kind:"undo",target:command.id})])
      expect(undone.map(r=>r.kind).sort()).toEqual(["applied","refused"])
    } finally { await store.close(); await rm(folder,{recursive:true,force:true}) }
  })
})
