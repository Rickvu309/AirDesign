import {createHmac} from "node:crypto"
import {expect,it} from "vitest"
import {localPaymentProvider,type PaymentEvent} from "../src/payments/provider.ts"

const secret="package-payment-fixture-only",provider=localPaymentProvider(secret)
const payment:PaymentEvent={id:"receipt_1",payment:"payment_1",cents:2500,kind:"paid"}

it("verifies each signed settlement kind and rejects forged or changed payloads",()=>{
  for(const kind of ["paid","refunded","chargeback"] as const){
    const event={...payment,kind},signed=provider.sign(event)
    expect(provider.verify(signed.body,signed.signature)).toEqual(event)
    expect(()=>provider.verify(signed.body,"0".repeat(64))).toThrow("invalid-signature")
    expect(()=>provider.verify(signed.body.replace("2500","2600"),signed.signature)).toThrow("invalid-signature")
  }
})

it("rejects malformed signed provider facts before they can reach the ledger",()=>{
  for(const value of [{...payment,cents:999},{...payment,cents:2500.5},{...payment,cents:Number.MAX_SAFE_INTEGER+1},{...payment,id:""},{...payment,payment:"x".repeat(101)},{...payment,kind:"pending"},null,[]]){
    const body=JSON.stringify(value),signature=createHmac("sha256",secret).update(body).digest("hex")
    expect(()=>provider.verify(body,signature)).toThrow("invalid-payment-event")
  }
})
