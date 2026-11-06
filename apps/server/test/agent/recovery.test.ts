import {expect,it} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {commandId} from "../../../../packages/change-log/src/index.ts"
import {localAdapter} from "../../../../packages/agent/src/local-adapter.ts"
import type {AgentAdapter} from "../../../../packages/agent/src/harness.ts"
import {localPaymentProvider} from "../../../../packages/usage/src/payments/provider.ts"
import {mcpFixture} from "../mcp/fixture.ts"
import {deferred,eventStream} from "./stream.ts"
it("resumes stopped work with one identity, skips accepted scopes and keeps later person edits on undo",async()=>{
  const entered=deferred(),release=deferred();let attempt=0
  const adapter:AgentAdapter=async function*(context,call,signal){attempt++;for await(const event of localAdapter(context,call,signal)){yield event;if(attempt===1&&event.kind==="tool"&&event.name==="apply_changes"){entered.resolve();await release.promise}}}
  const f=await mcpFixture({agentAdapter:adapter})
  try{
    const owner=await f.signIn("stopped@example.com");await f.json("/api/decks",fixtureDeck(2,2),owner.cookie)
    const stream=await eventStream(f.origin+"/api/aira/events?deck=deck",owner.cookie)
    try{
      const start=await (await f.json("/api/aira?deck=deck",{action:"send",text:"Saved request"},owner.cookie)).json()
      await entered.promise
      const stop=f.json("/api/aira?deck=deck",{action:"stop"},owner.cookie);release.resolve();expect((await stop).status).toBe(200)
      const saved=await f.history.read({personId:owner.personId},"deck")
      await f.history.commit({personId:owner.personId},"deck",{id:commandId("later_person"),kind:"patch",target:saved.deck.slides[0]!.id,fields:{notes:"Keep later edit"},base:saved.seq,run:null})
      const resumed=await f.json("/api/aira?deck=deck",{action:"resume"},owner.cookie)
      expect(resumed.status).toBe(202);expect(await resumed.json()).toMatchObject({id:start.id})
      let final=await stream.next();while(final.run?.id!==start.id||final.run.kind!=="complete")final=await stream.next()
      expect(final.run.completed).toEqual(["s0","s1"])
      expect(final.run.events.filter((event:{name?:string})=>event.name==="apply_changes")).toHaveLength(2)
      expect((await f.history.read({personId:owner.personId},"deck")).deck.slides[1]?.notes).toBe("Saved request")
      await f.json("/api/aira?deck=deck",{action:"undo"},owner.cookie)
      const undone=await f.history.read({personId:owner.personId},"deck")
      expect(undone.deck.slides[0]?.notes).toBe("Keep later edit");expect(undone.deck.slides[1]?.notes).not.toBe("Saved request")
    }finally{await stream.close()}
  }finally{release.resolve();await f.close()}
})
it("keeps typed usage refusal and resumes the saved request after a person resets",async()=>{
  const provider=localPaymentProvider("dev-only-local-payment-fixture")
  const f=await mcpFixture({paymentProvider:provider})
  try{
    const owner=await f.signIn("limited@example.com");await f.json("/api/decks",fixtureDeck(2,2),owner.cookie)
    await f.history.usage.reserve(owner.personId,{id:"exhaust",actor:"user-agent",request:"prior work",units:10000})
    const stream=await eventStream(f.origin+"/api/aira/events?deck=deck",owner.cookie)
    try{
      const start=await (await f.json("/api/aira?deck=deck",{action:"send",text:"Saved limit request"},owner.cookie)).json()
      let final=await stream.next();while(final.run?.id!==start.id||final.run.kind==="working")final=await stream.next()
      expect(final.run.kind).toBe("limited")
      const limit=final.run.events.find((event:{kind:string})=>event.kind==="limit")?.limit
      expect(limit.usage.hit).toEqual(expect.any(String));expect(limit.usage.week.resetsAt).toBeGreaterThan(0)
      const checkout=await (await f.json("/api/billing/checkout",{cents:1000},owner.cookie)).json()
      const signed=provider.sign({id:"recovery-paid",payment:checkout.payment.id,cents:1000,kind:"paid"})
      expect((await fetch(f.origin+"/api/billing/webhook",{method:"POST",headers:{"x-payment-signature":signed.signature},body:signed.body})).status).toBe(200)
      expect((await f.json("/api/usage/reset",{limitHit:limit.usage.hit},owner.cookie)).status).toBe(200)
      expect((await f.json("/api/aira?deck=deck",{action:"resume"},owner.cookie)).status).toBe(202)
      do{final=await stream.next()}while(final.run?.id!==start.id||final.run.kind!=="complete")
      expect(final.run.request).toBe("Saved limit request");expect(final.run.completed).toEqual(["s0","s1"])
    }finally{await stream.close()}
  }finally{await f.close()}
})
