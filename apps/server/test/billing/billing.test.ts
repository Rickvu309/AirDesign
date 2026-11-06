import {expect,it} from "vitest"
import pg from "pg"
import {localPaymentProvider,type PaymentEvent} from "../../../../packages/usage/src/payments/provider.ts"
import {createHistoryStore} from "../../src/db/history-store.ts"
import {mcpFixture} from "../mcp/fixture.ts"
import {eventStream} from "../agent/stream.ts"
const provider=localPaymentProvider("dev-only-local-payment-fixture")
it("serializes checkout and verified settlements, rejects forged receipts, keeps pending returns unspendable and reconciles idempotently",async()=>{
  const fixture=await mcpFixture({paymentProvider:provider}),second=await createHistoryStore({kind:"postgres",url:fixture.url},fixture.now)
  try{
    const owner=await fixture.signIn("billing-owner@example.com"),other=await fixture.signIn("billing-other@example.com")
    expect((await fixture.json("/api/billing/checkout",{cents:999},owner.cookie)).status).toBe(400)
    expect((await fixture.json("/api/billing/checkout",{cents:1001},owner.cookie)).status).toBe(400)
    const payments=await Promise.all([fixture.history.usage.checkout(owner.personId,2500),second.usage.checkout(owner.personId,1000),fixture.json("/api/billing/checkout",{cents:3000},owner.cookie).then(response=>response.json()).then(value=>value.payment)])
    expect(new Set(payments.map(payment=>payment.id)).size).toBe(1)
    const payment=payments[0]!
    expect((await fixture.history.usage.status(owner.personId)).paid).toBe(0)
    expect((await fixture.json(`/api/billing/payments/${payment.id}`,undefined,other.cookie)).status).toBe(400)
    const stream=await eventStream(fixture.origin+`/api/billing/payments/${payment.id}/events`,owner.cookie)
    try{
      expect((await stream.next()).kind).toBe("pending")
      const event:PaymentEvent={id:"paid-one",payment:payment.id,cents:payment.cents,kind:"paid"},signed=provider.sign(event)
      const forged=await fetch(fixture.origin+"/api/billing/webhook",{method:"POST",headers:{"x-payment-signature":"0".repeat(64)},body:signed.body});expect(forged.status).toBe(400);expect(await forged.json()).toEqual({code:"invalid-signature"})
      expect((await fixture.history.usage.status(owner.personId)).paid).toBe(0)
      const deliver=()=>fetch(fixture.origin+"/api/billing/webhook",{method:"POST",headers:{"x-payment-signature":signed.signature},body:signed.body})
      const race=await Promise.all([fixture.json(`/api/billing/payments/${payment.id}`,{},owner.cookie),deliver(),deliver(),second.usage.receivePayment(event)])
      expect(race.slice(0,3).every(response=>response instanceof Response&&response.ok)).toBe(true)
      let update=await stream.next();while(update.kind!=="paid")update=await stream.next()
      expect((await fixture.history.usage.status(owner.personId)).paid).toBe(payment.cents)
      expect((await fixture.history.usage.payment(owner.personId,payment.id,true)).kind).toBe("paid")
      await expect(second.usage.receivePayment({...event,kind:"chargeback"})).rejects.toThrow("receipt-payload-mismatch")
      await fixture.history.usage.reserve(owner.personId,{id:"model-record",actor:"aira",request:"fixture",units:2})
      const input={payments:[event],model:[{reservation:"model-record",units:6,actor:"aira" as const}]}
      const reports=await Promise.all([fixture.history.usage.reconcile(owner.personId,"reconcile-one",input),second.usage.reconcile(owner.personId,"reconcile-one",input)])
      expect(reports[0]).toEqual(reports[1]);expect(reports[0]).toMatchObject({missing:[],mismatched:[]})
      const mismatch=await fixture.history.usage.reconcile(owner.personId,"reconcile-mismatch",{payments:[{...event,id:"missing"}],model:[{reservation:"model-record",units:1,actor:"user-agent"}]})
      expect(mismatch).toMatchObject({missing:["missing"],mismatched:["model-record"]})
      expect((await fixture.history.usage.status(owner.personId)).paid).toBe(payment.cents)
      const direct=new pg.Client({connectionString:fixture.url});await direct.connect()
      try{await expect(direct.query("UPDATE usage_payment_receipt SET data=data")).rejects.toThrow("usage-events-are-append-only");await expect(direct.query("DELETE FROM usage_payment_receipt")).rejects.toThrow("usage-events-are-append-only");expect((await direct.query("SELECT * FROM usage_event WHERE kind='payment-credit'")).rowCount).toBe(1)}finally{await direct.end()}
    }finally{await stream.close()}
  }finally{await second.close();await fixture.close()}
})
it("expires stale links, accepts late paid events, reverses purchased credit only and never charges a provider for Reset",async()=>{
  const fixture=await mcpFixture({paymentProvider:provider})
  try{
    const owner=await fixture.signIn("billing-reversal@example.com")
    const expired=await fixture.history.usage.checkout(owner.personId,1000)
    fixture.advance(31*60000)
    expect((await (await fixture.json(`/api/billing/payments/${expired.id}`,undefined,owner.cookie)).json()).kind).toBe("expired")
    expect((await fixture.history.usage.status(owner.personId)).paid).toBe(0)
    const fresh=await fixture.history.usage.checkout(owner.personId,2000);expect(fresh.id).not.toBe(expired.id)
    await fixture.history.usage.receivePayment({id:"late",payment:expired.id,cents:1000,kind:"paid"})
    await fixture.history.usage.grantFixture(owner.personId,"bonus",400,"bonus")
    await fixture.history.usage.reserve(owner.personId,{id:"fill",actor:"user-agent",request:"fill",units:10000})
    const limit=await fixture.history.usage.reserve(owner.personId,{id:"blocked",actor:"user-agent",request:"saved",units:1});if(limit.kind!=="out-of-usage")throw new Error("expected-limit")
    const reset=await (await fixture.json("/api/usage/reset",{limitHit:limit.limitHit},owner.cookie)).json();expect(reset).toMatchObject({paid:900,bonus:0,used:0})
    const replay=await (await fixture.json("/api/usage/reset",{limitHit:limit.limitHit},owner.cookie)).json();expect(replay).toEqual(reset)
    await fixture.history.usage.grantFixture(owner.personId,"new-bonus",300,"bonus")
    await fixture.history.usage.receivePayment({id:"refund",payment:expired.id,cents:1000,kind:"refunded"})
    expect(await fixture.history.usage.status(owner.personId)).toMatchObject({paid:0,bonus:300})
    await fixture.history.usage.receivePayment({id:"later-chargeback",payment:expired.id,cents:1000,kind:"chargeback"})
    await fixture.history.usage.receivePayment({id:"duplicate-late-paid",payment:expired.id,cents:1000,kind:"paid"})
    expect(await fixture.history.usage.status(owner.personId)).toMatchObject({paid:0,bonus:300})
    const history=await fixture.history.usage.history(owner.personId)
    expect(history.items.some(event=>event.kind==="refunded")).toBe(true)
    expect(history.items.filter(event=>event.kind==="payment-credit")).toHaveLength(1)
  }finally{await fixture.close()}
})
