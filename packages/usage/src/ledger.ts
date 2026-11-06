import {lockRetainedAccount} from "../../access/src/account-retention.ts"
import type {PaymentEvent} from "./payments/provider.ts"
import { createHash, randomUUID } from "node:crypto"
import { usageWeek, type UsageWeek } from "./week.ts"
export type UsageActor = "user-agent" | "aira"
export const usageBilling={weeklyPriceCents:0,minimumPurchaseCents:1000,resetCents:500} as const
export const usageRates = { version: 1, allowance: 10000, "user-agent": 1, aira: 3 } as const
export type UsageTransaction = { query: <R>(sql: string, params?: unknown[]) => Promise<{ rows: R[] }> }
export type UsageTransactions = <T>(work: (tx: UsageTransaction) => Promise<T>) => Promise<T>
type Reservation = { hash: string; week: string; cycle: number; units: number; actor: UsageActor; status: "reserved" | "finished" | "platform-refunded" | "user-failed" }
type State = { week: UsageWeek; pendingZone: string | null; used: number; cycle: number; paid: number; bonus: number; autoReset: boolean; automaticResets: number; hit: string | null; hitAllowsAutomaticReset: boolean }
export type UsageSnapshot = State & { remaining: number; resetLink: "/settings/usage" }
export type Admission = { kind: "admitted"; reservation: string; duplicate: boolean } | { kind: "out-of-usage"; limitHit: string; request: string; usage: UsageSnapshot }
const snapshot = (state: State): UsageSnapshot => ({ ...state, remaining: Math.max(0, usageRates.allowance - state.used), resetLink: "/settings/usage" })
export type Payment={id:string;cents:number;kind:"pending"|"cancelled"|"expired"|"paid"|"reversed";expires:number}
export async function initializeUsage(tx: UsageTransaction) {
  await tx.query("CREATE TABLE IF NOT EXISTS account_deletion(owner text PRIMARY KEY,requested bigint NOT NULL,deadline bigint NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS account_deletion_receipt(id text PRIMARY KEY,completed bigint)")
  await tx.query("CREATE TABLE IF NOT EXISTS usage_payment (id text PRIMARY KEY, owner text NOT NULL, data jsonb NOT NULL)")
  await tx.query("CREATE UNIQUE INDEX IF NOT EXISTS usage_payment_one_pending ON usage_payment(owner) WHERE data->>'kind'='pending'")
  await tx.query("CREATE TABLE IF NOT EXISTS usage_payment_receipt (id text PRIMARY KEY, payment text NOT NULL REFERENCES usage_payment(id), data jsonb NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS usage_account (owner text PRIMARY KEY, state jsonb NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS usage_event (owner text NOT NULL REFERENCES usage_account(owner), id text NOT NULL, kind text NOT NULL, at bigint NOT NULL, data jsonb NOT NULL, PRIMARY KEY(owner,id))")
  await tx.query("CREATE OR REPLACE FUNCTION usage_event_immutable() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF TG_OP = ''DELETE'' THEN IF TG_TABLE_NAME = ''usage_event'' THEN IF EXISTS(SELECT 1 FROM account_deletion WHERE owner=OLD.owner) THEN RETURN OLD; END IF; ELSIF TG_TABLE_NAME = ''usage_payment_receipt'' THEN IF EXISTS(SELECT 1 FROM usage_payment p JOIN account_deletion d ON d.owner=p.owner WHERE p.id=OLD.payment) THEN RETURN OLD; END IF; END IF; END IF; RAISE EXCEPTION ''usage-events-are-append-only''; END'")
  if(!(await tx.query("SELECT 1 FROM pg_trigger WHERE tgname='usage_event_immutable'")).rows.length)await tx.query("CREATE TRIGGER usage_event_immutable BEFORE UPDATE OR DELETE ON usage_event FOR EACH ROW EXECUTE FUNCTION usage_event_immutable()")
  if(!(await tx.query("SELECT 1 FROM pg_trigger WHERE tgname='usage_event_no_truncate'")).rows.length)await tx.query("CREATE TRIGGER usage_event_no_truncate BEFORE TRUNCATE ON usage_event FOR EACH STATEMENT EXECUTE FUNCTION usage_event_immutable()")
  if(!(await tx.query("SELECT 1 FROM pg_trigger WHERE tgname='usage_payment_receipt_immutable'")).rows.length)await tx.query("CREATE TRIGGER usage_payment_receipt_immutable BEFORE UPDATE OR DELETE ON usage_payment_receipt FOR EACH ROW EXECUTE FUNCTION usage_event_immutable()")
  if(!(await tx.query("SELECT 1 FROM pg_trigger WHERE tgname='usage_payment_receipt_no_truncate'")).rows.length)await tx.query("CREATE TRIGGER usage_payment_receipt_no_truncate BEFORE TRUNCATE ON usage_payment_receipt FOR EACH STATEMENT EXECUTE FUNCTION usage_event_immutable()")
  await tx.query("CREATE TABLE IF NOT EXISTS usage_reservation (owner text NOT NULL REFERENCES usage_account(owner), id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(owner,id))")
}
export function usageLedger(transaction: UsageTransactions, clock = Date.now) {
  async function event(tx: UsageTransaction, owner: string, id: string, kind: string, data: unknown) {
    await tx.query("INSERT INTO usage_event(owner,id,kind,at,data) VALUES ($1,$2,$3,$4,$5)", [owner,id,kind,clock(),JSON.stringify(data)])
  }
  async function save(tx: UsageTransaction, owner: string, state: State) {
    await tx.query("UPDATE usage_account SET state=$2 WHERE owner=$1", [owner,JSON.stringify(state)])
  }
  async function account(tx: UsageTransaction, owner: string) {
    await lockRetainedAccount(tx,owner)
    const initial: State = { week: usageWeek(clock(), "UTC"), pendingZone: null, used: 0, cycle: 0, paid: 0, bonus: 0, autoReset: false, automaticResets: 0, hit: null, hitAllowsAutomaticReset: false }
    await tx.query("INSERT INTO usage_account(owner,state) VALUES ($1,$2) ON CONFLICT DO NOTHING", [owner,JSON.stringify(initial)])
    const found = await tx.query<{ state: State }>("SELECT state FROM usage_account WHERE owner=$1 FOR UPDATE", [owner])
    const state = found.rows[0]?.state
    if (!state) throw new Error("usage-account-missing")
    if (clock() >= state.week.resetsAt) {
      state.week = usageWeek(clock(), state.pendingZone ?? state.week.zone)
      state.pendingZone = null
      state.used = 0
      state.cycle = 0
      state.automaticResets = 0
      state.hit = null
      state.hitAllowsAutomaticReset = false
      await event(tx,owner,randomUUID(),"weekly-reset",state.week)
      await save(tx,owner,state)
    }
    return state
  }
  async function reset(tx: UsageTransaction, owner: string, state: State, hit: string, automatic: boolean) {
    if (!state.hit || state.hit !== hit || state.used < usageRates.allowance) throw new Error("stale-limit-hit")
    if (automatic && (!state.autoReset || state.automaticResets >= 3)) throw new Error("automatic-reset-unavailable")
    if (state.bonus + state.paid < usageBilling.resetCents) throw new Error("insufficient-credits")
    const bonus = Math.min(state.bonus,usageBilling.resetCents)
    state.bonus -= bonus
    state.paid -= usageBilling.resetCents - bonus
    state.used = 0
    state.hit = null
    state.hitAllowsAutomaticReset = false
    state.cycle++
    if (automatic) state.automaticResets++
    await event(tx,owner,`reset:${hit}`,"credit-reset",{hit,automatic,bonus,paid:usageBilling.resetCents-bonus,week:state.week.id,cycle:state.cycle})
    await save(tx,owner,state)
  }
  return {
    async status(owner: string) { return transaction(async tx => snapshot(await account(tx,owner))) },
    async configure(owner: string, input: { zone?: string; autoReset?: boolean }) {
      if (input.zone !== undefined) usageWeek(clock(),input.zone)
      return transaction(async tx => {
        const state = await account(tx,owner)
        if (input.zone !== undefined) state.pendingZone = input.zone === state.week.zone ? null : input.zone
        if (input.autoReset !== undefined) state.autoReset = input.autoReset
        await event(tx,owner,randomUUID(),"configured",input)
        await save(tx,owner,state)
        return snapshot(state)
      })
    },
    async reserve(owner: string, input: { id: string; actor: UsageActor; request: string; units: number }): Promise<Admission> {
      if (!input.id || input.id.length > 200 || input.request.length > 100000 || !Number.isSafeInteger(input.units) || input.units < 1 || input.units > usageRates.allowance) throw new Error("invalid-reservation")
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex")
      return transaction(async tx => {
        const state = await account(tx,owner)
        const prior = await tx.query<{ data: Reservation }>("SELECT data FROM usage_reservation WHERE owner=$1 AND id=$2", [owner,input.id])
        if (prior.rows[0]) {
          if (prior.rows[0].data.hash !== hash) throw new Error("request-id-payload-mismatch")
          return {kind:"admitted",reservation:input.id,duplicate:true}
        }
        const waiting = await tx.query<{data:{hash:string}}>("SELECT data FROM usage_event WHERE owner=$1 AND id=$2",[owner,`waiting:${input.id}`])
        if (waiting.rows[0] && waiting.rows[0].data.hash !== hash) throw new Error("request-id-payload-mismatch")
        if (state.used >= usageRates.allowance && state.hitAllowsAutomaticReset && input.actor === "aira" && state.autoReset && state.automaticResets < 3 && state.bonus + state.paid >= usageBilling.resetCents && state.hit) await reset(tx,owner,state,state.hit,true)
        if (state.used >= usageRates.allowance) {
          if (!state.hit) { state.hit = randomUUID(); await save(tx,owner,state) }
          if (!waiting.rows.length) await event(tx,owner,`waiting:${input.id}`,"request-kept",{...input,hash,hit:state.hit})
          return {kind:"out-of-usage",limitHit:state.hit,request:input.request,usage:snapshot(state)}
        }
        const units = input.units * usageRates[input.actor]
        const reservation: Reservation = {hash,units,actor:input.actor,week:state.week.id,cycle:state.cycle,status:"reserved"}
        await tx.query("INSERT INTO usage_reservation(owner,id,data) VALUES ($1,$2,$3)",[owner,input.id,JSON.stringify(reservation)])
        state.used += units
        if (state.used >= usageRates.allowance && !state.hit) { state.hit = randomUUID(); state.hitAllowsAutomaticReset = state.autoReset }
        await event(tx,owner,`debit:${input.id}`,"usage-debit",{...reservation,rateVersion:usageRates.version,request:input.request})
        await save(tx,owner,state)
        return {kind:"admitted",reservation:input.id,duplicate:false}
      })
    },
    async settle(owner: string, id: string, outcome: "finished" | "platform-refunded" | "user-failed") {
      return transaction(async tx => {
        const state = await account(tx,owner)
        const found = await tx.query<{data:Reservation}>("SELECT data FROM usage_reservation WHERE owner=$1 AND id=$2",[owner,id])
        const reservation = found.rows[0]?.data
        if (!reservation) throw new Error("reservation-not-found")
        if (reservation.status !== "reserved") {
          if (reservation.status !== outcome) throw new Error("reservation-already-settled")
          return snapshot(state)
        }
        reservation.status = outcome
        if (outcome === "platform-refunded" && reservation.week === state.week.id && reservation.cycle === state.cycle) {
          state.used = Math.max(0,state.used-reservation.units)
          if (state.used < usageRates.allowance) { state.hit = null; state.hitAllowsAutomaticReset = false }
        }
        await tx.query("UPDATE usage_reservation SET data=$3 WHERE owner=$1 AND id=$2",[owner,id,JSON.stringify(reservation)])
        await event(tx,owner,`settle:${id}`,outcome,{debit:`debit:${id}`,units:reservation.units,week:reservation.week,cycle:reservation.cycle})
        await save(tx,owner,state)
        return snapshot(state)
      })
    },
    async reset(owner: string, hit: string) {
      return transaction(async tx => {
        const state = await account(tx,owner)
        const prior = await tx.query("SELECT id FROM usage_event WHERE owner=$1 AND id=$2",[owner,`reset:${hit}`])
        if (!prior.rows.length) await reset(tx,owner,state,hit,false)
        return snapshot(state)
      })
    },
    async checkout(owner:string,cents:number){
      if(!Number.isSafeInteger(cents)||cents<usageBilling.minimumPurchaseCents||cents%100!==0||cents>1000000)throw new Error("invalid-payment-amount")
      return transaction(async tx=>{
        await account(tx,owner)
        const rows=await tx.query<{data:Payment}>("SELECT data FROM usage_payment WHERE owner=$1 AND data->>'kind'='pending' FOR UPDATE",[owner])
        const prior=rows.rows[0]?.data
        if(prior&&prior.expires>clock())return prior
        if(prior)await tx.query("UPDATE usage_payment SET data=$2 WHERE id=$1",[prior.id,JSON.stringify({...prior,kind:"expired"})])
        const payment:Payment={id:randomUUID(),cents,kind:"pending",expires:clock()+30*60000}
        await tx.query("INSERT INTO usage_payment(id,owner,data) VALUES($1,$2,$3)",[payment.id,owner,JSON.stringify(payment)])
        await event(tx,owner,`checkout:${payment.id}`,"checkout-created",payment)
        return payment
      })
    },
    async payment(owner:string,id:string,cancel=false){
      return transaction(async tx=>{
        await account(tx,owner)
        const payment=(await tx.query<{data:Payment}>("SELECT data FROM usage_payment WHERE id=$1 AND owner=$2 FOR UPDATE",[id,owner])).rows[0]?.data
        if(!payment)throw new Error("payment-not-found")
        if(payment.kind==="pending"&&(cancel||payment.expires<=clock())){
          payment.kind=cancel ? "cancelled" : "expired"
          await tx.query("UPDATE usage_payment SET data=$2 WHERE id=$1",[id,JSON.stringify(payment)])
          await event(tx,owner,`${payment.kind}:${id}`,`payment-${payment.kind}`,payment)
        }
        return payment
      })
    },
    async receivePayment(input:PaymentEvent){
      return transaction(async tx=>{
        const row=(await tx.query<{owner:string}>("SELECT owner FROM usage_payment WHERE id=$1",[input.payment])).rows[0]
        if(!row)throw new Error("payment-not-found")
        const state=await account(tx,row.owner)
        const owner=row.owner
        const payment=(await tx.query<{data:Payment}>("SELECT data FROM usage_payment WHERE id=$1 FOR UPDATE",[input.payment])).rows[0]?.data
        if(!payment||payment.cents!==input.cents)throw new Error("payment-amount-mismatch")
        const prior=(await tx.query<{data:PaymentEvent}>("SELECT data FROM usage_payment_receipt WHERE id=$1",[input.id])).rows[0]
        if(prior){if(prior.data.id!==input.id||prior.data.payment!==input.payment||prior.data.cents!==input.cents||prior.data.kind!==input.kind)throw new Error("receipt-payload-mismatch");return payment}
        await tx.query("INSERT INTO usage_payment_receipt(id,payment,data) VALUES($1,$2,$3)",[input.id,input.payment,JSON.stringify(input)])
        if(input.kind==="paid"&&payment.kind!=="paid"&&payment.kind!=="reversed"){
          if(!Number.isSafeInteger(state.paid+payment.cents))throw new Error("credit-overflow")
          state.paid+=payment.cents;payment.kind="paid"
          await event(tx,owner,`paid:${payment.id}`,"payment-credit",{payment:payment.id,cents:payment.cents,kind:"paid"})
        }
        if(input.kind!=="paid"&&payment.kind!=="reversed"){
          const removed=payment.kind==="paid" ? Math.min(state.paid,payment.cents) : 0
          state.paid-=removed;payment.kind="reversed"
          await event(tx,owner,`reversed:${payment.id}`,input.kind,{payment:payment.id,cents:payment.cents,removed})
        }
        await event(tx,owner,`provider:${input.id}`,"verified-payment-receipt",input)
        await tx.query("UPDATE usage_payment SET data=$2 WHERE id=$1",[payment.id,JSON.stringify(payment)])
        await save(tx,owner,state)
        return payment
      })
    },
    async reconcile(owner:string,id:string,input:{payments:PaymentEvent[];model:{reservation:string;units:number;actor:UsageActor}[]}){
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||input.payments.length>1000||input.model.length>1000)throw new Error("invalid-reconciliation")
      return transaction(async tx=>{
        await account(tx,owner)
        const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex")
        const prior=(await tx.query<{data:{hash:string;missing:string[];mismatched:string[]}}>("SELECT data FROM usage_event WHERE owner=$1 AND id=$2",[owner,`reconcile:${id}`])).rows[0]?.data
        if(prior){if(prior.hash!==hash)throw new Error("reconciliation-id-reused");return prior}
        const missing:string[]=[],mismatched:string[]=[]
        for(const payment of input.payments){
          const receipt=(await tx.query<{data:PaymentEvent}>("SELECT r.data FROM usage_payment_receipt r JOIN usage_payment p ON p.id=r.payment WHERE r.id=$1 AND p.owner=$2",[payment.id,owner])).rows[0]?.data
          if(!receipt)missing.push(payment.id)
          else if(receipt.payment!==payment.payment||receipt.cents!==payment.cents||receipt.kind!==payment.kind)mismatched.push(payment.id)
        }
        for(const model of input.model){
          const reservation=(await tx.query<{data:Reservation}>("SELECT data FROM usage_reservation WHERE owner=$1 AND id=$2",[owner,model.reservation])).rows[0]?.data
          if(!reservation)missing.push(model.reservation)
          else if(reservation.units!==model.units||reservation.actor!==model.actor)mismatched.push(model.reservation)
        }
        const report={hash,missing,mismatched}
        await event(tx,owner,`reconcile:${id}`,"usage-reconciled",report)
        return report
      })
    },
    async grantFixture(owner: string, id: string, cents: number, kind: "paid" | "bonus") {
      if (!Number.isSafeInteger(cents) || cents < 1) throw new Error("invalid-fixture-grant")
      return transaction(async tx => {
        const state = await account(tx,owner)
        const found = await tx.query<{data:{cents:number;kind:string}}>("SELECT data FROM usage_event WHERE owner=$1 AND id=$2",[owner,`grant:${id}`])
        if (found.rows[0]) {
          if (found.rows[0].data.cents !== cents || found.rows[0].data.kind !== kind) throw new Error("request-id-payload-mismatch")
        } else {
          if (!Number.isSafeInteger(state[kind]+cents)) throw new Error("credit-overflow")
          state[kind] += cents
          await event(tx,owner,`grant:${id}`,"fixture-credit",{cents,kind})
          await save(tx,owner,state)
        }
        return snapshot(state)
      })
    },
    async history(owner:string,cursor?:string){
      let boundary:{at:string;id:string}|null=null
      if(cursor){const value:unknown=JSON.parse(Buffer.from(cursor,"base64url").toString());if(!value||typeof value!=="object"||!("at" in value)||typeof value.at!=="string"||!/^\d+$/.test(value.at)||!("id" in value)||typeof value.id!=="string")throw new Error("invalid-history-cursor");boundary={at:value.at,id:value.id}}
      return transaction(async tx=>{
        const rows=(await tx.query<{id:string;kind:string;at:string;data:unknown}>("SELECT id,kind,at,data FROM usage_event WHERE owner=$1 AND ($2::bigint IS NULL OR (at,id)<($2::bigint,$3::text)) ORDER BY at DESC,id DESC LIMIT 101",[owner,boundary?.at ?? null,boundary?.id ?? null])).rows
        const items=rows.slice(0,100),last=items.at(-1)
        return {items,nextCursor:rows.length>100&&last ? Buffer.from(JSON.stringify({at:String(last.at),id:last.id})).toString("base64url") : null}
      })
    },
    async events(owner: string) { return transaction(async tx => (await tx.query("SELECT id,kind,at,data FROM usage_event WHERE owner=$1 ORDER BY at,id LIMIT 100",[owner])).rows) },
  }
}
