import { useEffect, useRef, useState } from "react"
import { Button } from "@airdesign/ui"
import { commandId, type Command, type CommandId } from "../../../../packages/change-log/src/index.ts"
import { flatten, id, type Id, type Run } from "../../../../packages/deck/src/index.ts"
import { fixtureDeck } from "../../../../packages/deck/src/fixture.ts"
import { Slide } from "../../../../packages/render/src/index.ts"
import { SyncClient, parseSnapshot } from "../../../../packages/rpc/src/client.ts"
import { indexedOutbox, type Pending } from "../../../../packages/rpc/src/outbox.ts"
import { cachedSnapshot, currentPerson, transport } from "./transport.ts"
import "../render/render-fixture.css"

function requestId() { return commandId(crypto.randomUUID()) }
const labels = {saved:"Saved",pending:"Saving…",offline:"Offline · changes saved on this device",retrying:"Still offline · reconnect to save your changes",recovery:"Some changes need your attention",deleted:"This deck was deleted. Your unsaved changes are kept on this device.","signed-out":"Sign in to the same account to save your changes."}
export function SyncFixture() {
  const [,render]=useState(0)
  const [message,setMessage]=useState("")
  const [missing,setMissing]=useState(false)
  const [run,setRun]=useState<string | null>(null)
  const [selectedSlide,setSelectedSlide]=useState("")
  const client=useRef<SyncClient | null>(null)
  const connection=useRef<ReturnType<typeof transport> | null>(null)
  const undo=useRef<CommandId[]>([]), redo=useRef<CommandId[]>([])
  const deckId=new URLSearchParams(location.search).get("deck") ?? "deck"
  const [loaded,setLoaded]=useState(false)
  async function load(create=false) {
    connection.current?.close()
    try {
      let person:string | null
      try { person=await currentPerson();if (person) sessionStorage.setItem("editing-person",person) } catch { person=sessionStorage.getItem("editing-person") }
      if (!person) { setMessage("Sign in before opening this deck.");setLoaded(true);return }
      let snapshot=cachedSnapshot(person,deckId)
      let deleted=false
      try {
        const response=await fetch(create ? "/api/decks" : `/api/decks/${deckId}`,create ? {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...fixtureDeck(5,2),id:id(deckId)})} : undefined)
        if (response.status===404) {setMissing(true);setLoaded(true);return}
        if (response.status===401) {setMessage("Sign in before opening this deck.");setLoaded(true);return}
        if (response.status===410) deleted=true
        else {
          if (!response.ok) throw new Error("Could not open this deck")
          snapshot=parseSnapshot(await response.json())
          localStorage.setItem(JSON.stringify(["snapshot",person,deckId]),JSON.stringify(snapshot))
        }
      } catch(error) {if (!snapshot) throw error}
      if (!snapshot) throw new Error(deleted ? "This deck was deleted." : "No saved copy is available on this device")
      const sync=new SyncClient(person,snapshot,indexedOutbox(),()=>render(n=>n+1))
      await sync.load()
      client.current=sync
      undo.current=sync.queue.filter(item=>(item.command.kind==="edit" || item.command.kind==="patch") && item.command.run===null).map(item=>item.command.id)
      redo.current=[]
      if (deleted) sync.stop("deleted")
      connection.current=deleted ? null : transport(sync,person,deckId,setMessage)
      setMissing(false);setLoaded(true);setMessage("")
    } catch(error) {setMessage(String(error));setLoaded(true)}
  }
  useEffect(()=>{void load();return ()=>connection.current?.close()},[])
  async function enqueue(command:Command,personEdit=false) {
    try {await client.current?.enqueue(command);if(personEdit){undo.current.push(command.id);redo.current=[]}} catch(error){setMessage(String(error))}
  }
  function patch(target:Id,fields:Extract<Command,{kind:"patch"}>["fields"]) {
    const sync=client.current
    if(sync) void enqueue({id:requestId(),kind:"patch",target,fields,base:sync.seq,run:null},true)
  }
  function commitText(target:Id,runs:[Run,...Run[]]) {patch(target,JSON.parse(JSON.stringify({runs})))}
  function historyText(direction:"undo"|"redo") {
    const target=(direction==="undo" ? undo : redo).current.pop()
    if(!target) return
    const destination=(direction==="undo" ? redo : undo)
    destination.current.push(target)
    void enqueue({id:requestId(),kind:direction,target})
  }
  async function recover(item:Extract<Pending,{kind:"rejected"}>) {
    const sync=client.current
    if (!sync || !item.restore || (item.command.kind!=="patch" && item.command.kind!=="edit")) return
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(item.command.id))
    const suffix=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("")
    try {await sync.recover(item.command.id,[{id:commandId(`restore_${suffix}`),kind:"undo",target:item.restore},{...item.command,id:commandId(`retry_${suffix}`),base:sync.seq}])} catch(error){setMessage(String(error))}
  }
  const sync=client.current, deck=sync?.deck, state=sync?.state
  const blocked=state?.kind==="deleted" || state?.kind==="signed-out"
  const connected=state?.kind==="saved"
  const slide=deck?.slides.find(item=>item.id===selectedSlide) ?? deck?.slides[0]
  return <main className="render-fixture" data-sync-state={state?.kind ?? "loading"} data-seq={sync?.seq ?? 0} data-ready={loaded}>
    <h1>Durable editing · sync fixture</h1>
    {state && <p role="status">{labels[state.kind]}{"count" in state && state.count>0 ? ` · ${state.count} pending` : ""}</p>}
    <div className="render-controls">
      <a href="/">Account</a>
      {missing && <Button size="compact" variant="primary" onClick={()=>void load(true)}>Create fixture deck</Button>}
      <Button size="compact" variant="secondary" disabled={!sync || blocked} onPointerDown={e=>e.preventDefault()} onClick={()=>historyText("undo")}>Undo</Button>
      <Button size="compact" variant="secondary" disabled={!sync || blocked} onPointerDown={e=>e.preventDefault()} onClick={()=>historyText("redo")}>Redo</Button>
      <Button size="compact" variant="secondary" onClick={()=>connection.current?.reconnect()}>Reconnect</Button>
      <Button size="compact" variant="primary" disabled={!connected}>Ask</Button><Button size="compact" variant="primary" disabled={!connected}>Export</Button>
      <Button size="compact" variant="secondary" disabled={!connected} onClick={()=>{const next=crypto.randomUUID();setRun(next);void enqueue({id:requestId(),kind:"start-run",run:next})}}>Start agent request</Button>
      <Button size="compact" variant="secondary" disabled={!connected || !run || !slide} onClick={()=>{if(sync && run && slide) void enqueue({id:requestId(),kind:"patch",base:sync.seq,run,target:slide.id,fields:{notes:"Agent draft"}})}}>Apply agent draft</Button>
      <Button size="compact" variant="secondary" disabled={!connected || !run} onClick={()=>{if(run) void enqueue({id:requestId(),kind:"undo-run",run})}}>Undo agent request</Button>
    </div>
    {deck && <p>{deck.slides.length} slides · revision {sync?.seq} · {slide ? flatten(slide.elements).length : 0} visible elements</p>}
    {slide && <><label htmlFor="sync-slide">Slide</label><select id="sync-slide" value={slide.id} onChange={event=>setSelectedSlide(event.target.value)}>{deck?.slides.map((item,index)=><option key={item.id} value={item.id}>Slide {index+1}</option>)}</select></>}
    {slide && <><label htmlFor="sync-notes">Speaker notes</label><textarea id="sync-notes" disabled={blocked} value={slide.notes} onChange={e=>patch(slide.id,{notes:e.target.value})} /><div className="render-viewport"><Slide slide={slide} themes={deck?.themes} commitText={blocked ? undefined : commitText} historyText={historyText} /></div></>}
    {deck && !slide && <p>This deck has no slides. Changes to a removed slide can be restored below.</p>}
    {sync?.queue.map(item=>item.kind==="rejected" ? <section key={item.command.id} aria-label="Recover a change"><p>Change {item.command.id}: {item.code}. Your original change is kept on this device.</p>{item.restore && <Button size="compact" variant="primary" disabled={blocked || state?.kind==="offline" || state?.kind==="retrying"} onClick={()=>void recover(item)}>Restore deleted slide and retry</Button>}<Button size="compact" variant="secondary" onClick={()=>void sync.dismiss(item.command.id)}>Discard this change</Button><details><summary>Original change</summary><pre>{JSON.stringify(item.command,null,2)}</pre></details></section> : null)}
    {state?.kind==="signed-out" && <a href="/">Sign in</a>}
    {state?.kind==="deleted" && <Button size="compact" variant="secondary" onClick={()=>{const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([JSON.stringify(sync?.queue)],{type:"application/json"}));link.download="unsaved-changes.json";link.click();URL.revokeObjectURL(link.href)}}>Download unsaved changes</Button>}
    {message && <p role="alert">{message}</p>}
  </main>
}
