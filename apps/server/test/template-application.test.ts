import { it,expect } from "vitest"
import { createHistoryStore } from "../src/db/history-store.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { commandId } from "../../../packages/change-log/src/index.ts"
import { applyTemplate,basics } from "../../../packages/brand/src/index.ts"

it("serializes prepared template applications, deduplicates retries and preserves protected person edits",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"},deck=fixtureDeck(1),dark=basics[1]!
  try{
    await store.create(owner,deck)
    const command={id:commandId("look"),kind:"edit" as const,base:0,run:null,changes:{changes:[]}}
    const preparation={key:"dark-v1",changes:(value:typeof deck)=>applyTemplate(value,dark,{kind:"apply-deck"}).changes}
    await store.commit(owner,deck.id,{id:commandId("start"),kind:"start-run",run:"agent"})
    const results=await Promise.all([store.commit(owner,deck.id,command,undefined,preparation),store.commit(owner,deck.id,command,undefined,preparation)])
    expect(results[0]).toEqual(results[1])
    expect(results[0]?.kind).toBe("applied")
    const snapshot=await store.read(owner,deck.id)
    expect(snapshot.seq).toBe(2)
    expect(snapshot.deck.template).toEqual({id:"dark",version:1,family:"basic"})
    await expect(store.commit({personId:"other"},deck.id,command,undefined,preparation)).rejects.toThrow("deck-not-found")
    await expect(store.commit(owner,deck.id,command,undefined,{...preparation,key:"light-v1"})).rejects.toThrow("request-id-payload-mismatch")
    await store.commit(owner,deck.id,{id:commandId("later"),kind:"patch",base:2,run:null,target:deck.slides[0]!.id,fields:{notes:"Keep my notes"}})
    await store.commit(owner,deck.id,{id:commandId("undo-look"),kind:"undo",target:command.id})
    const undone=await store.read(owner,deck.id)
    expect(undone.deck.template).toBeUndefined()
    expect(undone.deck.slides[0]?.notes).toBe("Keep my notes")
  }finally{await store.close()}
})
