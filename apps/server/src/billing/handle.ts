import {mutationRejection,type Access} from "@airdesign/access"
import type {HistoryStore} from "../db/history-store.ts"
import type {Payment} from "../../../../packages/usage/src/ledger.ts"
import type {PaymentProvider} from "../../../../packages/usage/src/payments/provider.ts"
export function billingHandler(access:Access,history:HistoryStore,provider:PaymentProvider|undefined,origin:string){
  const listeners=new Map<string,Set<(payment:Payment)=>void>>()
  async function handle(request:Request){
    try{
      if(!provider)return Response.json({code:"payments-unavailable"},{status:503})
      const path=new URL(request.url).pathname
      if(path==="/api/billing/webhook"&&request.method==="POST"){
        const body=await request.text();if(Buffer.byteLength(body)>10000)throw new Error("receipt-too-large")
        const event=provider.verify(body,request.headers.get("x-payment-signature") ?? "")
        const payment=await history.usage.receivePayment(event)
        for(const send of listeners.get(payment.id) ?? [])send(payment)
        return Response.json({acknowledged:true,payment})
      }
      const rejection=mutationRejection(request,origin);if(rejection)return Response.json(rejection,{status:rejection.status})
      const principal=await access.principal(request);if(!principal)return Response.json({code:"signed-out"},{status:401})
      if(path==="/api/billing/checkout"&&request.method==="POST"){
        const input:unknown=await request.json()
        if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==1||!("cents" in input)||typeof input.cents!=="number")throw new Error("invalid-checkout")
        const payment=await history.usage.checkout(principal.personId,input.cents)
        return Response.json({payment,url:provider.checkout(payment.id),provider:provider.kind})
      }
      const match=/^\/api\/billing\/payments\/([a-f0-9-]{36})(\/events)?$/.exec(path),id=match?.[1]
      if(id&&(request.method==="GET"||request.method==="POST")){
        const payment=await history.usage.payment(principal.personId,id,request.method==="POST")
        if(match?.[2]&&request.method==="GET"){
          let send:(value:Payment)=>void=()=>{}
          const body=new ReadableStream<Uint8Array>({start(controller){send=value=>controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));const group=listeners.get(id) ?? new Set();group.add(send);listeners.set(id,group);send(payment)},cancel(){listeners.get(id)?.delete(send)}})
          return new Response(body,{headers:{"content-type":"text/event-stream","cache-control":"no-cache"}})
        }
        for(const send of listeners.get(id) ?? [])send(payment)
        return Response.json(payment)
      }
      return Response.json({code:"not-found"},{status:404})
    }catch(error){return Response.json({code:error instanceof Error ? error.message : "payment-failed"},{status:400})}
  }
  return handle
}
