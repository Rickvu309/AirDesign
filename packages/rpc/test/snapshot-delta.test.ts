import { expect,it } from "vitest"
import { commandId,execute,initialHistory } from "../../change-log/src/index.ts"
import { fixtureDeck } from "../../deck/src/fixture.ts"
import { id } from "../../deck/src/index.ts"
import { parseMessage } from "../src/wire.ts"
import { parseSnapshot } from "../src/client.ts"
import { snapshotDelta } from "../src/snapshot-delta.ts"

it("merges incremental edits and toggles without reparsing retained contributions",()=>{
  const first=execute(initialHistory(fixtureDeck(2)),{id:commandId("first"),kind:"patch",target:id("s0"),fields:{notes:"first"},base:0,run:null}).history
  const previous=parseSnapshot({deck:first.deck,seq:first.seq,contributions:{history:first,applied:[commandId("first")]}})
  const next=execute(first,{id:commandId("next"),kind:"patch",target:id("s0"),fields:{notes:"next"},base:1,run:null}).history
  const update=snapshotDelta({deck:next.deck,seq:next.seq,contributions:{history:next,applied:[commandId("first"),commandId("next")]}},1)
  const parsed=parseSnapshot(update,previous)
  expect(parsed.contributions?.history.events).toHaveLength(2)
  expect(parsed.contributions?.history.events[0]).toBe(previous.contributions?.history.events[0])
  expect(parsed.contributions?.history.initial).toBe(previous.contributions?.history.initial)
  const undone=execute(next,{id:commandId("undo"),kind:"undo",target:commandId("first")}).history
  const toggled=parseSnapshot(snapshotDelta({deck:undone.deck,seq:undone.seq,contributions:{history:undone,applied:[]}},2),parsed)
  expect(toggled.contributions?.history.events[0]?.active).toBe(false)
  expect(()=>parseSnapshot(update)).toThrow("history-base-mismatch")
})

it("reuses only the exact preceding checkpoint for individual batch receipts",()=>{
 const previous=parseMessage({kind:"receipt",receipt:{kind:"applied",id:"first",seq:1},deck:fixtureDeck(1),seq:100})
 if(previous.kind!=="receipt")throw new Error("expected-receipt")
 const frame={kind:"receipt",receipt:{kind:"applied",id:"last",seq:100},checkpoint:"previous",deckId:previous.deck.id,seq:100}
 const receipt=parseMessage(frame,previous)
 expect(receipt.kind).toBe("receipt")
 if(receipt.kind!=="receipt")throw new Error("expected-receipt")
 expect(receipt.deck).toBe(previous.deck)
 expect(receipt.receipt.id).toBe("last")
 expect(()=>parseMessage(frame)).toThrow("missing-receipt-checkpoint")
 expect(()=>parseMessage({...frame,seq:99},previous)).toThrow("missing-receipt-checkpoint")
 expect(()=>parseMessage({...frame,deckId:"other"},previous)).toThrow("missing-receipt-checkpoint")
 expect(()=>parseMessage({...frame,receipt:{...frame.receipt,seq:101}},previous)).toThrow("invalid-receipt-sequence")
})
