import {createHmac,timingSafeEqual} from "node:crypto"
export type PaymentAvailability={kind:"unavailable"}|{kind:"configured"}
export type PaymentEvent={id:string;payment:string;cents:number;kind:"paid"|"refunded"|"chargeback"}
export interface PaymentProvider {kind:"local-fixture";verify:(body:string,signature:string)=>PaymentEvent;checkout:(id:string)=>string}
export function localPaymentProvider(secret:string):PaymentProvider & {sign:(event:PaymentEvent)=>{body:string;signature:string}}{
  const signature=(body:string)=>createHmac("sha256",secret).update(body).digest("hex")
  return {kind:"local-fixture",checkout:id=>`/settings/usage?payment=${encodeURIComponent(id)}`,sign(event){const body=JSON.stringify(event);return {body,signature:signature(body)}},verify(body,provided){
    const expected=signature(body)
    if(!/^[a-f0-9]{64}$/.test(provided)||!timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(provided,"hex")))throw new Error("invalid-signature")
    const input:unknown=JSON.parse(body)
    if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("invalid-payment-event")
    if(!("id" in input)||typeof input.id!=="string"||input.id.length>100||!input.id||!("payment" in input)||typeof input.payment!=="string"||(!input.payment||input.payment.length>100)||!("cents" in input)||typeof input.cents!=="number"||!Number.isSafeInteger(input.cents)||input.cents<1000||!("kind" in input)||(input.kind!=="paid"&&input.kind!=="refunded"&&input.kind!=="chargeback"))throw new Error("invalid-payment-event")
    return {id:input.id,payment:input.payment,cents:input.cents,kind:input.kind}
  }}
}
