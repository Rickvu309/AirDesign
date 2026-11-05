import { useEffect,useRef,useState } from "react"
import { Button } from "@airdesign/ui"
import type { Operation } from "../../../../packages/operations/src/index.ts"
import type { DeckEntry } from "../../../../packages/catalog/src/index.ts"
import { currentPerson } from "../sync/transport.ts"
import { api } from "../decks/catalog-client.ts"

export function ImportCard({finished,choosing=false,dismiss=()=>{}}:{finished:()=>Promise<void>;choosing?:boolean;dismiss?:()=>void}) {
  const input=useRef<HTMLInputElement>(null)
  const [key,setKey]=useState(""),[id,setId]=useState<string|null>(null)
  const [operation,setOperation]=useState<Operation|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[title,setTitle]=useState("Imported deck"),[opened,setOpened]=useState<string|null>(null)
  useEffect(()=>{let stopped=false;void currentPerson().then(person=>{if(!person||stopped)return;const value=JSON.stringify(["import",person]);setKey(value);setTitle(localStorage.getItem(value+"title") ?? "Imported deck");setId(localStorage.getItem(value))}).catch(failure=>setError(String(failure)));return ()=>{stopped=true}},[])
  useEffect(()=>{if(!id)return;let stopped=false,timer:ReturnType<typeof setTimeout>;async function refresh(){try{const value=await api<Operation>(`/api/operations/${id}`);if(stopped)return;setOperation(value);if(value.kind==="queued"||value.kind==="running")timer=setTimeout(()=>void refresh(),400)}catch(failure){if(!stopped)setError(String(failure))}}void refresh();return ()=>{stopped=true;clearTimeout(timer)}},[id,operation?.kind])
  async function upload(file:File){setBusy(true);setError("");setOpened(null);try{if(file.size>50*1024*1024)throw new Error("Choose a PowerPoint smaller than 50 MB.");let binary="";for(const byte of new Uint8Array(await file.arrayBuffer()))binary+=String.fromCharCode(byte);const value=await api<Operation>("/api/operations",{requestId:crypto.randomUUID(),base64:btoa(binary)});const name=file.name.replace(/\.pptx$/i,"");setTitle(name);localStorage.setItem(key+"title",name);localStorage.setItem(key,value.id);setId(value.id);setOperation(value)}catch(failure){setError(String(failure))}finally{setBusy(false)}}
  async function keep(){if(!operation)return;try{const result=await api<{entry:DeckEntry}>("/api/catalog/import",{operation:operation.id,requestId:`import_${operation.id}`,title});setOpened(result.entry.id);await finished()}catch(failure){setError(String(failure))}}
  const report=operation?.kind==="ready" ? operation.report : null
  const capabilities=report && Array.isArray(report.capabilities) ? report.capabilities : []
  const counts={native:0,kept:0,flagged:0}
  for(const item of capabilities)if(item && typeof item==="object" && "support" in item){if(item.support==="native")counts.native++;else if(item.support==="kept")counts.kept++;else counts.flagged++}
  function remove(){if(key){localStorage.removeItem(key);localStorage.removeItem(key+"title")}setId(null);setOperation(null);setError("");setOpened(null);dismiss()}
  if(!choosing&&!id&&!busy&&!error)return null
  const failed=operation?.kind==="failed"||Boolean(error)
  return <section className="import-card" aria-labelledby="import-heading" role={failed ? "alert" : undefined}><p className="import-filename">{title}</p><h2 id="import-heading">{failed ? "Unable to import this file" : busy||operation?.kind==="queued"||operation?.kind==="running" ? "Importing PowerPoint" : "Bring your PowerPoint"}</h2><p>{failed ? "Your original file is unchanged. Choose another PowerPoint to try again." : "Review what is editable and what stays in the original before opening it."}</p><label className="workspace-file" hidden={failed}>Import PowerPoint<input ref={input} aria-label="Import PowerPoint" type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={busy||!key} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}/></label>
    <p role="status">{busy ? "Uploading your PowerPoint…" : operation?.kind==="ready" ? "Import ready. Review the report below." : operation?.kind==="queued" ? "Import queued. You can close this tab and return here." : operation?.kind==="running" ? "Checking your PowerPoint…" : operation?.kind==="cancelled" ? "Import cancelled." : operation?.kind==="expired" ? "Import result expired. Choose your file again." : ""}</p>
    {report && <div className="import-report"><h3>{title}</h3><dl><div><dt>Native</dt><dd>{counts.native} editable items</dd></div><div><dt>Kept</dt><dd>{counts.kept} original items preserved</dd></div><div><dt>Flagged</dt><dd>{counts.flagged} items to review</dd></div></dl><p>Unsupported objects have no invented preview. Original PowerPoint parts are retained. Visual fidelity in PowerPoint is pending the P09 reference check.</p><details><summary>Import details</summary><pre>{JSON.stringify(report,null,2)}</pre></details>{opened ? <a href={`/deck/${opened}`}>Open imported deck</a> : <Button size="dialog" variant="primary" onClick={()=>void keep()}>Keep and open deck</Button>}</div>}
    {operation && ["queued","running"].includes(operation.kind) && <Button size="compact" variant="secondary" onClick={()=>void api<Operation>(`/api/operations/${operation.id}/cancel`,{}).then(setOperation).catch(failure=>setError(String(failure)))}>Cancel import</Button>}
    {failed && <div className="import-recovery"><Button size="dialog" variant="primary" onClick={()=>input.current?.click()}>Choose another file</Button><Button size="dialog" variant="secondary" onClick={remove}>Remove</Button><details><summary>Details</summary><pre>{error|| (operation?.kind==="failed" ? operation.reason : "")}</pre></details></div>}
  </section>
}
