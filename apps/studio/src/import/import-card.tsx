import {runningProgressSchema} from "../../../../packages/operations/src/import-progress.ts"
import { useEffect,useRef,useState } from "react"
import { Button } from "@airdesign/ui"
import type { Operation } from "../../../../packages/operations/src/index.ts"
import type { DeckEntry } from "../../../../packages/catalog/src/index.ts"
import { currentPerson } from "../sync/transport.ts"
import { api } from "../decks/catalog-client.ts"

export function ImportCard({finished,choosing=false,dismiss=()=>{},openDeck=id=>window.location.assign(`/deck/${id}`)}:{finished:()=>Promise<void>;choosing?:boolean;dismiss?:()=>void;openDeck?:(id:string)=>void}) {
  const input=useRef<HTMLInputElement>(null)
  const [key,setKey]=useState(""),[id,setId]=useState<string|null>(null)
  const [operation,setOperation]=useState<Operation|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[title,setTitle]=useState("Imported deck")
  useEffect(()=>{let stopped=false;void currentPerson().then(person=>{if(!person||stopped)return;const value=JSON.stringify(["import",person]);setKey(value);setTitle(localStorage.getItem(value+"title") ?? "Imported deck");setId(localStorage.getItem(value))}).catch(failure=>setError(String(failure)));return ()=>{stopped=true}},[])
  useEffect(()=>{if(!id)return;let stopped=false,timer:ReturnType<typeof setTimeout>;async function refresh(){try{const value=await api<Operation>(`/api/operations/${id}`);if(stopped)return;if(value.kind==="running")value.progress=runningProgressSchema.parse(value.progress);setOperation(value);if(value.kind==="queued"||value.kind==="running")timer=setTimeout(()=>void refresh(),400)}catch(failure){if(!stopped)setError(String(failure))}}void refresh();return ()=>{stopped=true;clearTimeout(timer)}},[id,operation?.kind])
  async function upload(file:File){setBusy(true);setError("");try{if(file.size>50*1024*1024)throw new Error("Choose a PowerPoint smaller than 50 MB.");let binary="";for(const byte of new Uint8Array(await file.arrayBuffer()))binary+=String.fromCharCode(byte);const value=await api<Operation>("/api/operations",{requestId:crypto.randomUUID(),base64:btoa(binary)});const name=file.name.replace(/\.pptx$/i,"");setTitle(name);localStorage.setItem(key+"title",name);localStorage.setItem(key,value.id);setId(value.id);setOperation(value)}catch(failure){setError(String(failure))}finally{setBusy(false)}}
  async function keep(){if(!operation||busy)return;setBusy(true);try{const result=await api<{entry:DeckEntry}>("/api/catalog/import",{operation:operation.id,requestId:`import_${operation.id}`,title});await finished();if(key){localStorage.removeItem(key);localStorage.removeItem(key+"title")}openDeck(result.entry.id)}catch(failure){setError(String(failure))}finally{setBusy(false)}}
  const report=operation?.kind==="ready" ? operation.report : null
  const capabilities=report && Array.isArray(report.capabilities) ? report.capabilities : []
  const counts={native:0,kept:0,flagged:0}
  for(const item of capabilities)if(item && typeof item==="object" && "support" in item){if(item.support==="native")counts.native++;else if(item.support==="kept")counts.kept++;else counts.flagged++}
  function remove(){if(key){localStorage.removeItem(key);localStorage.removeItem(key+"title")}setId(null);setOperation(null);setError("");dismiss()}
  if(!choosing&&!id&&!busy&&!error)return null
  const failed=operation?.kind==="failed"||Boolean(error)
  const progress=operation?.kind==="running"&&operation.progress.kind==="import-slides"&&operation.progress.total>0 ? operation.progress : null
  const running=busy||operation?.kind==="queued"||operation?.kind==="running"
  return <section className="import-card deck-card" data-import-state={failed ? "failed" : running ? "running" : "choose"} aria-labelledby="import-heading" role={failed ? "alert" : undefined}>
    <div className="deck-card-details"><p className="import-filename">{title}</p><h2 id="import-heading" className="deck-visually-hidden">{failed ? "Unable to import this file" : running ? "Importing PowerPoint" : "Bring your PowerPoint"}</h2><p role="status">{failed ? "Unable to import" : busy ? "Uploading PowerPoint…" : running ? "Importing PowerPoint…" : operation?.kind==="ready" ? "Ready to open" : operation?.kind==="cancelled" ? "Import cancelled" : operation?.kind==="expired" ? "Import expired" : "Choose a PowerPoint"}</p></div>
    <input ref={input} className="deck-visually-hidden" aria-label="Import PowerPoint" type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={busy||!key} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}/>
    <div className="import-cover"><span className="import-file-mark" aria-hidden="true">PPTX</span>
      {running&&<><progress aria-label="Import progress" value={progress?.completed} max={progress?.total}/>{progress&&<span>{progress.completed} of {progress.total} slides</span>}</>}
      {!failed&&!running&&!report&&<Button size="dialog" variant="secondary" onClick={()=>input.current?.click()}>Choose a PowerPoint</Button>}
      {failed&&<div className="import-recovery"><Button size="dialog" variant="secondary" onClick={()=>input.current?.click()}>Choose another file</Button><Button size="compact" variant="link" onClick={remove}>Remove</Button></div>}
    </div>
    {report&&<div className="import-report"><dl><div><dt>Native</dt><dd>{counts.native} editable items</dd></div><div><dt>Kept</dt><dd>{counts.kept} original items preserved</dd></div><div><dt>Flagged</dt><dd>{counts.flagged} items to review</dd></div></dl><p>Unsupported objects have no invented preview. Original PowerPoint parts are retained. Visual fidelity in PowerPoint is pending the P09 reference check.</p><details><summary>Import details</summary><pre>{JSON.stringify(report,null,2)}</pre></details><Button size="dialog" variant="primary" disabled={busy} onClick={()=>void keep()}>Keep and open deck</Button></div>}
    {operation&&["queued","running"].includes(operation.kind)&&<div className="import-cancel"><Button size="compact" variant="link" onClick={()=>void api<Operation>(`/api/operations/${operation.id}/cancel`,{}).then(setOperation).catch(failure=>setError(String(failure)))}>Cancel import</Button></div>}
    {failed&&<details className="import-diagnostics"><summary>Details</summary><pre>{error||(operation?.kind==="failed" ? operation.reason : "")}</pre></details>}
  </section>
}
