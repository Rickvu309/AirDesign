import { useEffect,useRef,useState } from "react"
import { Button } from "@airdesign/ui"
import type { Deck,Id } from "../../../../packages/deck/src/index.ts"
import { flatten } from "../../../../packages/deck/src/index.ts"
import { fontReport } from "../../../../packages/render/src/fonts.ts"
import type { ExportJob } from "../../../server/src/decks/export-store.ts"
import { api } from "../decks/catalog-client.ts"

export function ExportDialog({deck,seq,open,close,fix,disabled}:{deck:Deck;seq:number;open:boolean;close:()=>void;fix:(slide:Id)=>void;disabled:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null),[format,setFormat]=useState<"pptx"|"pdf">("pptx"),[timing,setTiming]=useState<"now"|"after-run">("now"),[range,setRange]=useState("")
  const [id,setId]=useState<string|null>(null),[jobs,setJobs]=useState<ExportJob[]>([]),[job,setJob]=useState<ExportJob|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false)
  const issues=deck.slides.filter(slide=>flatten(slide.elements).some(element=>element.support.kind!=="native")||fontReport(slide,deck.themes).missing.length)
  useEffect(()=>{if(open && !dialog.current?.open)dialog.current?.showModal();if(!open && dialog.current?.open)dialog.current?.close()},[open])
  useEffect(()=>{let stopped=false,timer:ReturnType<typeof setTimeout>;async function refresh(){try{
    const values=await api<ExportJob[]>(`/api/catalog/${deck.id}/exports`)
    if(stopped)return
    setJobs(values)
    const selected=values.find(value=>value.id===id) ?? values.at(-1)
    setJob(selected ?? null)
    if(values.some(value=>["waiting","queued","running"].includes(value.kind)) || open)timer=setTimeout(()=>void refresh(),400)
  }catch(failure){if(!stopped)setError(String(failure))}}void refresh();return ()=>{stopped=true;clearTimeout(timer)}},[deck.id,id,open])
  async function submit(allowIssues:boolean){if(disabled){setError("Wait until your changes are saved and you are online.");return}setBusy(true);setError("");try{
    const numbers=range.trim() ? range.split(",").map(value=>Number(value.trim())) : []
    if(numbers.some(value=>!Number.isInteger(value)||value<1||value>deck.slides.length)||new Set(numbers).size!==numbers.length)throw new Error("Enter slide numbers separated by commas, such as 1, 3.")
    const slides=numbers.map(number=>deck.slides[number-1]!.id)
    const value=await api<ExportJob>(`/api/catalog/${deck.id}/exports`,{requestId:crypto.randomUUID(),format,timing,slides,expectedSeq:seq,allowIssues})
    setJobs(current=>[...current,value]);setId(value.id);setJob(value)
  }catch(failure){setError(String(failure))}finally{setBusy(false)}}
  async function action(action:"cancel"|"retry"){if(!job)return;try{setJob(await api<ExportJob>(`/api/catalog/export-jobs/${job.id}/${action}`,{}))}catch(failure){setError(String(failure))}}
  return <><dialog className="workspace-dialog export-dialog" ref={dialog} aria-labelledby="export-title" onCancel={close} onClose={close}>
    <header><h2 id="export-title">Export your deck</h2><Button size="compact" variant="secondary" onClick={close}>Close export</Button></header>
    {jobs.length>1 && <label>Retained exports<select aria-label="Retained exports" value={job?.id ?? ""} onChange={event=>{setId(event.target.value);setJob(jobs.find(value=>value.id===event.target.value) ?? null)}}>{jobs.map(value=><option key={value.id} value={value.id}>{value.format.toUpperCase()} · {value.kind} · {value.id.slice(0,8)}</option>)}</select></label>}
    <p>Export the saved version. Changes you make afterward stay in your deck.</p>
    <label>File format<select aria-label="File format" value={format} onChange={event=>setFormat(event.target.value==="pdf" ? "pdf" : "pptx")}><option value="pptx">PowerPoint (.pptx)</option><option value="pdf">PDF (.pdf)</option></select></label>
    <label>Slides<input aria-label="Export slides" placeholder="All slides, or 1, 3" value={range} onChange={event=>setRange(event.target.value)}/></label>
    <fieldset><legend>When</legend><label><input type="radio" name="timing" checked={timing==="now"} onChange={()=>setTiming("now")}/>Export now · saved version {seq}</label><label><input type="radio" name="timing" checked={timing==="after-run"} onChange={()=>setTiming("after-run")}/>After the current run finishes</label></fieldset>
    {issues.length>0 && <section className="export-review"><h3>Review before exporting</h3><p>{issues.length} slides have kept objects or font substitutions. Original objects stay in PowerPoint. PDF uses the available preview; objects without one show “Preview unavailable”.</p><ul>{issues.map(slide=><li key={slide.id}>Slide {deck.slides.indexOf(slide)+1}: {fontReport(slide,deck.themes).missing.join(", ") || "Kept or flagged objects"} <Button size="compact" variant="secondary" onClick={()=>{close();fix(slide.id)}}>Fix slide {deck.slides.indexOf(slide)+1}</Button></li>)}</ul></section>}
    <Button size="dialog" variant="primary" disabled={disabled||busy||!deck.slides.length} onClick={()=>void submit(issues.length>0)}>{issues.length ? "Export anyway" : "Create export"}</Button>
    <p role="status">{job ? job.kind==="ready" ? `Your ${job.format.toUpperCase()} is ready · saved version ${job.seq}. Available for 7 days.` : job.kind==="waiting" ? "Waiting for the current run to finish. You can close this tab." : job.kind==="queued" ? "Export queued. You can close this tab and return here." : job.kind==="running" ? "Creating your export…" : job.kind==="failed" ? `Export failed: ${job.reason}. Your deck is safe.` : job.kind==="expired" ? "This download expired. Create a new export." : "Export cancelled. Your deck is safe." : ""}</p>
    {job?.kind==="ready" && <a className="workspace-download" href={`/api/catalog/export-jobs/${job.id}/artifact`} download>Download {job.format.toUpperCase()}</a>}
    {job && ["waiting","queued","running"].includes(job.kind) && <Button size="compact" variant="secondary" onClick={()=>void action("cancel")}>Cancel export</Button>}
    {job?.kind==="failed" && job.attempts<3 && <Button size="compact" variant="secondary" onClick={()=>void action("retry")}>Retry export</Button>}
    {job?.diagnostics.length ? <details><summary>Export diagnostics</summary><pre>{job.diagnostics.join("\n")}</pre></details> : null}
    {error && <p role="alert">{error}</p>}
  </dialog>{!open && job?.kind==="ready" && <p role="status" className="export-reattach">Your {job.format.toUpperCase()} export is ready. Open Export to download saved version {job.seq}.</p>}</>
}
