import {AddCredits} from "../settings/add-credits.tsx"
import {useEffect,useState} from "react"
import {AlertDialog,Button,TextField,copy,toast} from "@airdesign/ui"
import type {UsageSnapshot} from "../../../../packages/usage/src/ledger.ts"
type UsageEvent={id:string;kind:string;at:number;data:unknown}
async function usageRequest(path:string,input?:unknown) {
  const response=await fetch(`/api/usage${path}`,input===undefined ? {} : {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)})
  if(!response.ok)throw new Error("Unable to update usage. Your work is saved. Try again.")
  return response.json()
}
export function UsagePanel() {
  const [usage,setUsage]=useState<UsageSnapshot|null>(null),[events,setEvents]=useState<UsageEvent[]>([])
  const [nextCursor,setNextCursor]=useState<string|null>(null)
  const [zone,setZone]=useState(""),[error,setError]=useState(""),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false)
  async function refresh() {const value:UsageSnapshot=await usageRequest("");setUsage(value);setZone(value.pendingZone ?? value.week.zone);const history=await usageRequest("/history");setEvents(history.items);setNextCursor(history.nextCursor)}
  useEffect(()=>{void refresh().catch(failure=>setError(String(failure)))},[])
  async function update(path:string,input:unknown) {setBusy(true);setError("");try{await usageRequest(path,input);await refresh();if(path==="/reset"){setConfirm(false);toast(copy("usage.reset_done"))}}catch(failure){setError(String(failure))}finally{setBusy(false)}}
  if(!usage)return <p role="status">{error || "Opening usage…"}</p>
  const balance=(usage.paid+usage.bonus)/100,percent=Math.min(100,Math.round(usage.used/100))
  return <div className="settings-panels">
    {error && <p role="alert">{error}</p>}
    {usage.remaining===0 && <section className="settings-card usage-limit" role="status"><h2>{copy("usage.limit_title")}</h2><p>{copy("usage.limit_body")}</p><p>Manual editing is available.</p></section>}
    <section className="settings-card"><div className="settings-row"><div><h2>{copy("usage.title")}</h2><p>{copy("usage.resets")} · {usage.week.zone}</p></div><Button variant="secondary" size="compact" disabled={busy||usage.remaining>0} onClick={()=>setConfirm(true)}>{copy("usage.reset_action")}</Button></div><div className="settings-row"><progress value={percent} max={100} aria-label="Weekly usage"/><span>{percent}% used</span></div><p>Next reset: <time dateTime={new Date(usage.week.resetsAt).toISOString()}>{new Date(usage.week.resetsAt).toLocaleString(undefined,{timeZone:usage.week.zone})}</time></p></section>
    <section className="settings-card"><div className="settings-row"><h2>{copy("credits.title")}</h2><AddCredits refresh={refresh}/></div><p className="credit-balance">${balance.toFixed(2)}</p><p>{copy("credits.facts")}</p><div className="settings-row settings-divider"><div><h2>{copy("auto.title")}</h2><p>Spend $5 in credits to reset when usage reaches the limit, at most three times a week. Connected agents cannot spend credits.</p></div><label className="settings-switch"><input type="checkbox" checked={usage.autoReset} disabled={busy} onChange={event=>void update("/configure",{autoReset:event.target.checked})}/>Enable auto reset</label></div></section>
    <section className="settings-card"><h2>Week time zone</h2><p>Changes take effect at the next reset.</p><form className="settings-row" onSubmit={event=>{event.preventDefault();void update("/configure",{zone})}}><TextField label="IANA time zone" value={zone} onChange={event=>setZone(event.target.value)}/><Button type="submit" variant="secondary" size="compact" disabled={busy}>Save time zone</Button></form>{usage.pendingZone && <p role="status">{usage.pendingZone} starts at the next reset.</p>}</section>
    <section className="settings-card"><h2>History</h2>{!events.length ? <p>No usage yet.</p> : <ul className="usage-history">{events.map(event=><li key={event.id}><time>{new Date(Number(event.at)).toLocaleDateString()}</time><span>{event.kind.replaceAll("-"," ")}</span></li>)}</ul>}{nextCursor && <Button variant="secondary" size="compact" onClick={()=>{void usageRequest(`/history?cursor=${encodeURIComponent(nextCursor)}`).then(page=>{setEvents([...events,...page.items]);setNextCursor(page.nextCursor)})}}>Show older history</Button>}</section>
    <AlertDialog open={confirm} title={balance<5 ? "Add credits to reset" : copy("usage.reset_confirm_title")} body={balance<5 ? "You need $5 in credits to reset. Add credits below; your request is saved. Manual editing is available." : copy("usage.reset_confirm_body")} onClose={()=>setConfirm(false)} secondary={{label:copy("common.cancel")}} primary={balance<5 ? {label:"Close",onClick:()=>setConfirm(false)} : {label:"Reset for $5",onClick:()=>{if(usage.hit)void update("/reset",{limitHit:usage.hit})}}}/>
  </div>
}
