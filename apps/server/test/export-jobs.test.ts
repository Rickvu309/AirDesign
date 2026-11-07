import { it,expect } from "vitest"
import { createHistoryStore } from "../src/db/history-store.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { commandId } from "../../../packages/change-log/src/index.ts"

it("pins concurrent exports to one saved version, enforces owners, cancellation and seven-day results",async()=>{
  let now=1000
  const store=await createHistoryStore({kind:"pglite"},()=>now),person={personId:"person"},other={personId:"other"}
  try {
    const entry=await store.catalog.create(person,"deck","Board","",fixtureDeck(2))
    const options={format:"pptx",slides:[],timing:"now",expectedSeq:0,allowIssues:false} as const
    const [first,retry]=await Promise.all([store.exports.submit(person,"same",entry.id,{...options,slides:[]}),store.exports.submit(person,"same",entry.id,{...options,slides:[]})])
    expect(first.id).toBe(retry.id)
    await expect(store.exports.status(other,first.id)).rejects.toThrow("export-not-found")
    await store.commit(person,entry.id,{id:commandId("later"),kind:"patch",base:0,run:null,target:fixtureDeck(2).slides[0]!.id,fields:{notes:"Later edit"}})
    const claims=await Promise.all([store.exports.claim(),store.exports.claim()]),claimed=claims.find(value=>value!==null)
    expect(claims.filter(Boolean)).toHaveLength(1)
    expect(claimed?.snapshot.seq).toBe(0)
    expect(claimed?.snapshot.deck.slides[0]?.notes).toBe("Canonical render fixture")
    if(!claimed)throw new Error("claim-required")
    await store.exports.cancel(person,first.id)
    expect(await store.exports.complete(first.id,claimed.lease,Buffer.from("late"),{})).toBe(false)
    expect((await store.exports.status(person,first.id)).kind).toBe("cancelled")
    const ready=await store.exports.submit(person,"ready",entry.id,{...options,slides:[],expectedSeq:1})
    const second=await store.exports.claim();if(!second)throw new Error("claim-required")
    expect(await store.exports.complete(ready.id,second.lease,Buffer.from("result"),{seq:1})).toBe(true)
    expect((await store.exports.artifact(person,ready.id)).seq).toBe(1)
    now+=7*86400000
    expect((await store.exports.status(person,ready.id)).kind).toBe("expired")
    await expect(store.exports.artifact(person,ready.id)).rejects.toThrow("unavailable")
  }finally{await store.close()}
})
it("captures after-run only after closure and retries the same version with original diagnostics",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),person={personId:"person"}
  try {
    const entry=await store.catalog.create(person,"deck","Board","",fixtureDeck(2))
    await store.commit(person,entry.id,{id:commandId("start"),kind:"start-run",run:"fixture"})
    const pending=await store.exports.submit(person,"after",entry.id,{format:"pdf",slides:[],timing:"after-run",expectedSeq:1,allowIssues:true})
    expect(pending.kind).toBe("waiting");expect(await store.exports.claim()).toBeNull()
    await store.commit(person,entry.id,{id:commandId("edit"),kind:"patch",target:fixtureDeck(2).slides[0]!.id,fields:{notes:"Whole commit"},base:1,run:null})
    await store.commit(person,entry.id,{id:commandId("close"),kind:"close-run",run:"fixture"})
    const claimed=await store.exports.claim();if(!claimed)throw new Error("claim-required")
    expect(claimed.snapshot.seq).toBe(3);expect(claimed.snapshot.deck.slides[0]?.notes).toBe("Whole commit")
    await store.exports.fail(pending.id,claimed.lease,"worker-failure")
    const retry=await store.exports.retry(person,pending.id)
    expect(retry.id).toBe(pending.id);expect(retry.diagnostics).toContain("worker-failure")
    const second=await store.exports.claim();if(!second)throw new Error("claim-required")
    expect(second.snapshot).toEqual(claimed.snapshot)
    expect(await store.exports.complete(pending.id,second.lease,Buffer.from("PDF"),{})).toBe(true)
    expect(await store.exports.claim()).toBeNull()
  }finally{await store.close()}
})
it("reclaims expired leases without accepting a stale result and bounds crash retries",async()=>{
  let now=1000
  const store=await createHistoryStore({kind:"pglite"},()=>now),person={personId:"person"}
  try{
    const entry=await store.catalog.create(person,"lease","Lease","",fixtureDeck(2))
    const job=await store.exports.submit(person,"lease",entry.id,{format:"pdf",slides:[],timing:"now",expectedSeq:0,allowIssues:false})
    const first=await store.exports.claim();if(!first)throw new Error("claim-required")
    expect(first.deadline-now).toBe(60000)
    now=first.deadline
    expect(await store.exports.complete(job.id,first.lease,Buffer.from("late"),{})).toBe(false)
    const second=await store.exports.claim();if(!second)throw new Error("claim-required")
    expect(second.lease).not.toBe(first.lease);expect(second.snapshot).toEqual(first.snapshot)
    expect(await store.exports.complete(job.id,first.lease,Buffer.from("stale"),{})).toBe(false)
    now=second.deadline
    const third=await store.exports.claim();if(!third)throw new Error("claim-required")
    now=third.deadline
    expect(await store.exports.claim()).toBeNull()
    const failed=await store.exports.status(person,job.id)
    expect(failed.kind).toBe("failed");expect(failed.attempts).toBe(3);expect(failed.diagnostics).toHaveLength(3)
    await expect(store.exports.retry(person,job.id)).rejects.toThrow("export-retry-unavailable")
  }finally{await store.close()}
})
