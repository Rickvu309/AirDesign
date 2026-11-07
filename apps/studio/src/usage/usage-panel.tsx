import {AddCredits} from "../settings/add-credits.tsx"
import {useEffect,useState} from "react"
import {AlertDialog,Button,TextField,copy,toast} from "@airdesign/ui"
import type {UsageSnapshot} from "../../../../packages/usage/src/ledger.ts"
import type {PaymentAvailability} from "../../../../packages/usage/src/payments/provider.ts"
type UsageStatus=UsageSnapshot & {payments:PaymentAvailability}
type UsageEvent={id:string;kind:string;at:number;data:unknown}
async function usageRequest(path:string,input?:unknown) {
  const response=await fetch(`/api/usage${path}`,input===undefined ? {} : {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)})
  if(!response.ok)throw new Error("Unable to update usage. Your work is saved. Try again.")
  return response.json()
}
export function UsagePanel() {
  const [usage,setUsage]=useState<UsageStatus|null>(null),[events,setEvents]=useState<UsageEvent[]>([])
  const [nextCursor,setNextCursor]=useState<string|null>(null)
  const [zone,setZone]=useState(""),[error,setError]=useState(""),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false)
  async function refresh() {const value:UsageStatus=await usageRequest("");setUsage(value);setZone(value.pendingZone ?? value.week.zone);const history=await usageRequest("/history");setEvents(history.items);setNextCursor(history.nextCursor)}
  useEffect(()=>{void refresh().catch(failure=>setError(String(failure)))},[])
  async function update(path:string,input:unknown) {setBusy(true);setError("");try{await usageRequest(path,input);await refresh();if(path==="/reset"){setConfirm(false);toast(copy("usage.reset_done"))}}catch(failure){setError(String(failure))}finally{setBusy(false)}}
  if(!usage)return <p role="status">{error || "Opening usage…"}</p>
  const history=events.flatMap(event=>{if(!event.data||typeof event.data!=="object")return [];if(event.kind==="payment-credit"&&"cents" in event.data&&typeof event.data.cents==="number")return [{...event,label:copy("history.added"),amount:`+$${(event.data.cents/100).toFixed(2)}`}];if((event.kind==="refunded"||event.kind==="chargeback")&&"removed" in event.data&&typeof event.data.removed==="number")return [{...event,label:event.kind==="refunded" ? "Payment refunded" : "Payment reversed",amount:`-$${(event.data.removed/100).toFixed(2)}`}];if(event.kind==="credit-reset")return [{...event,label:copy("history.reset"),amount:"-$5.00"}];return []})
  const balance=(usage.paid+usage.bonus)/100,percent=Math.min(100,Math.round(usage.used/100))
  return <div className="settings-panels">
    {error && <p role="alert">{error}</p>}
    {usage.remaining===0 && <section className="settings-card usage-limit" role="status"><h2>{copy("usage.limit_title")}</h2><p>{copy("usage.limit_body")}</p><p>Manual editing is available.</p></section>}
    <section className="settings-card"><div className="settings-row"><div><h2>{copy("usage.title")}</h2><p>{copy("usage.resets")}</p></div><Button variant="secondary" size="compact" disabled={busy||usage.remaining>0} onClick={()=>setConfirm(true)}>{copy("usage.reset_action")}</Button></div><div className="settings-row"><progress value={percent} max={100} aria-label="Weekly usage"/><span>{percent}% used</span></div></section>
    <section className="settings-card"><div className="settings-row"><div><h2>{copy("credits.title")}</h2><p className="credit-balance">${balance.toFixed(2)}</p><p>{copy("credits.facts")}</p></div>{usage.payments.kind==="configured" ? <AddCredits refresh={refresh} balance={usage.paid+usage.bonus}/> : <p>{copy("credits.unavailable")}</p>}</div><div className="settings-row settings-divider"><div><h2>{copy("auto.title")}</h2><p>{copy("auto.body")}</p></div><label className="settings-switch"><input aria-label="Enable auto reset" type="checkbox" checked={usage.autoReset} disabled={busy} onChange={event=>void update("/configure",{autoReset:event.target.checked})}/><span aria-hidden="true"/></label></div></section>
    <section className="settings-card"><h2>History</h2>{!history.length ? <p>No credit activity yet.</p> : <ul className="usage-history">{history.map(event=><li key={event.id}><time>{new Date(Number(event.at)).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</time><span>{event.label}</span><strong>{event.amount}</strong></li>)}</ul>}{nextCursor && <Button variant="secondary" size="compact" onClick={()=>{void usageRequest(`/history?cursor=${encodeURIComponent(nextCursor)}`).then(page=>{setEvents([...events,...page.items]);setNextCursor(page.nextCursor)})}}>Show older history</Button>}</section>
    <details className="settings-usage-controls"><summary>Reset limits and time zone</summary><p>Spend $5 in credits to reset when usage reaches the limit, at most three times a week. Connected agents cannot spend credits.</p><p>Changes take effect at the next reset.</p><form className="settings-row" onSubmit={event=>{event.preventDefault();void update("/configure",{zone})}}><TextField label="IANA time zone" value={zone} onChange={event=>setZone(event.target.value)}/><Button type="submit" variant="secondary" size="compact" disabled={busy}>Save time zone</Button></form>{usage.pendingZone && <p role="status">{usage.pendingZone} starts at the next reset.</p>}</details>
    <AlertDialog open={confirm} title={balance<5 ? "Add credits to reset" : copy("usage.reset_confirm_title")} body={balance<5 ? usage.payments.kind==="configured" ? "You need $5 in credits to reset. Add credits below; your request is saved. Manual editing is available." : "You need $5 in credits to reset. Buying credits is not available yet. Your request is saved. Manual editing is available." : copy("usage.reset_confirm_body")} onClose={()=>setConfirm(false)} secondary={{label:copy("common.cancel")}} primary={balance<5 ? {label:"Close",onClick:()=>setConfirm(false)} : {label:"Reset for $5",onClick:()=>{if(usage.hit)void update("/reset",{limitHit:usage.hit})}}}/>
  </div>
}
