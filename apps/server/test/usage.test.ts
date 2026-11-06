import { expect, it } from "vitest"
import { createHistoryStore } from "../src/db/history-store.ts"
import { usageRates } from "../../../packages/usage/src/ledger.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { commandId } from "../../../packages/change-log/src/index.ts"
import { usageHandler } from "../src/usage/handle.ts"
it("serializes admission at the limit, preserves requests, refunds only platform failures and resets once", async () => {
  const store = await createHistoryStore({kind:"pglite"})
  const ledger = store.usage
  try {
    const request = {id:"near-limit",actor:"user-agent" as const,request:"Build the strategy",units:usageRates.allowance-1}
    await ledger.reserve("owner",request)
    const repeated = await Promise.all([ledger.reserve("owner",request),ledger.reserve("owner",request)])
    expect(repeated.every(value => value.kind === "admitted" && value.duplicate)).toBe(true)
    await expect(ledger.reserve("owner",{...request,units:1})).rejects.toThrow("request-id-payload-mismatch")
    const final = await Promise.all(["a","b"].map(id => ledger.reserve("owner",{...request,id,units:1})))
    expect(final.filter(value => value.kind === "admitted")).toHaveLength(1)
    const exhausted = final.find(value => value.kind === "out-of-usage")
    expect(exhausted).toMatchObject({kind:"out-of-usage",request:request.request,usage:{remaining:0,resetLink:"/settings/usage"}})
    expect(await ledger.status("other")).toMatchObject({used:0,paid:0})
    const debit = final[0]?.kind === "admitted" ? "a" : "b"
    await ledger.settle("owner",debit,"user-failed")
    expect((await ledger.status("owner")).remaining).toBe(0)
    await expect(ledger.settle("owner",debit,"platform-refunded")).rejects.toThrow("already-settled")
    await ledger.grantFixture("owner","grant",600,"paid")
    if (exhausted?.kind !== "out-of-usage") throw new Error("expected-limit")
    const resets = await Promise.all([ledger.reset("owner",exhausted.limitHit),ledger.reset("owner",exhausted.limitHit)])
    expect(resets[0]).toEqual(resets[1])
    expect(resets[0]).toMatchObject({used:0,paid:100,cycle:1})
    await ledger.reserve("owner",{...request,id:"platform",units:1})
    await Promise.all([ledger.settle("owner","platform","platform-refunded"),ledger.settle("owner","platform","platform-refunded")])
    expect((await ledger.status("owner")).used).toBe(0)
    const events = await ledger.events("owner")
    expect(events.filter(value => typeof value === "object" && value !== null && "kind" in value && value.kind === "platform-refunded")).toHaveLength(1)
  } finally { await store.close() }
})
it("does not let remote agents spend and caps enabled Aira resets at three with bonus-first debits",async () => {
  const store = await createHistoryStore({kind:"pglite"})
  try {
    const ledger = store.usage
    await ledger.grantFixture("owner","paid",2000,"paid")
    await ledger.grantFixture("owner","bonus",200,"bonus")
    await ledger.configure("owner",{autoReset:true})
    await ledger.reserve("owner",{id:"first",actor:"user-agent",request:"first",units:10000})
    expect(await ledger.reserve("owner",{id:"remote",actor:"user-agent",request:"kept",units:1})).toMatchObject({kind:"out-of-usage"})
    expect(await ledger.status("owner")).toMatchObject({paid:2000,bonus:200})
    for (let index=0;index<3;index++) expect(await ledger.reserve("owner",{id:`aira-${index}`,actor:"aira",request:"continue",units:10000})).toMatchObject({kind:"admitted"})
    expect(await ledger.reserve("owner",{id:"fourth",actor:"aira",request:"kept",units:1})).toMatchObject({kind:"out-of-usage"})
    expect(await ledger.status("owner")).toMatchObject({paid:700,bonus:0,automaticResets:3})
    expect(await ledger.status("other")).toMatchObject({paid:0,bonus:0})
  } finally {await store.close()}
})
it("defers zone changes and never refunds an old week's debit into the new allowance",async () => {
  let now=Date.parse("2026-03-04T12:00:00Z")
  const store = await createHistoryStore({kind:"pglite"},()=>now)
  try {
    const ledger=store.usage
    const original=await ledger.status("owner")
    await ledger.reserve("owner",{id:"old",actor:"aira",request:"saved",units:100})
    const pending=await ledger.configure("owner",{zone:"America/New_York"})
    expect(pending.week).toEqual(original.week)
    expect(pending.used).toBe(300)
    now=original.week.resetsAt
    const next=await ledger.status("owner")
    expect(next).toMatchObject({used:0,pendingZone:null,week:{zone:"America/New_York"}})
    await ledger.reserve("owner",{id:"new",actor:"user-agent",request:"new",units:10})
    await ledger.settle("owner","old","platform-refunded")
    expect((await ledger.status("owner")).used).toBe(10)
  } finally {await store.close()}
})
it("meters authoritative run commits while manual editing stays available",async () => {
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"},deck=fixtureDeck(1)
  try {
    await store.create(owner,deck)
    await store.commit(owner,deck.id,{id:commandId("start"),kind:"start-run",run:"run"})
    await store.usage.reserve(owner.personId,{id:"consume",actor:"user-agent",request:"consume",units:10000})
    const edit={id:commandId("agent"),kind:"edit" as const,base:1,run:"run",changes:{changes:[]}}
    expect(await store.commit(owner,deck.id,edit,{kind:"run",run:"run"})).toMatchObject({kind:"refused",code:"out-of-usage"})
    expect((await store.read(owner,deck.id)).seq).toBe(1)
    expect(await store.commit(owner,deck.id,{...edit,id:commandId("manual"),run:null})).toMatchObject({kind:"applied"})
    const access={principal:async()=>owner,handle:async()=>new Response(),close:async()=>undefined}
    const handler=usageHandler(access,store,"http://localhost")
    const response=await handler(new Request("http://localhost/api/usage/fixture-credit",{method:"POST",headers:{origin:"http://localhost","content-type":"application/json"},body:JSON.stringify({owner:"other",cents:10000})}))
    expect(response.status).toBe(404)
    expect((await store.usage.status("other")).paid).toBe(0)
  } finally {await store.close()}
})

it("keeps request identity across reset and requires a person to clear an existing hit before newly enabled automation",async()=>{
  const store=await createHistoryStore({kind:"pglite"})
  try {
    const ledger=store.usage
    await ledger.grantFixture("owner","credit",1000,"paid")
    await ledger.reserve("owner",{id:"fill",actor:"user-agent",request:"fill",units:10000})
    const kept={id:"kept",actor:"aira" as const,request:"saved request",units:1}
    const blocked=await ledger.reserve("owner",kept)
    await ledger.configure("owner",{autoReset:true})
    expect(await ledger.reserve("owner",kept)).toMatchObject({kind:"out-of-usage"})
    expect((await ledger.status("owner")).paid).toBe(1000)
    if(blocked.kind!=="out-of-usage") throw new Error("expected-limit")
    await ledger.reset("owner",blocked.limitHit)
    await expect(ledger.reserve("owner",{...kept,request:"changed"})).rejects.toThrow("request-id-payload-mismatch")
    expect(await ledger.reserve("owner",kept)).toMatchObject({kind:"admitted"})
  } finally {await store.close()}
})
