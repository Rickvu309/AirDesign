import { EditorErrorNotice } from "./editor-error-notice.tsx"
import {ChatPanel} from "../chat/chat-panel.tsx"
import {airaRequest} from "../chat/aira-client.ts"
import { ImagePanel } from "../images/image-panel.tsx"
import { TemplatePanel } from "../templates/template-panel.tsx"
import { useCallback,useEffect,useRef,useState,type MouseEvent } from "react"
import { AlertDialog,Button,copy } from "@airdesign/ui"
import { commandId,type Command } from "../../../../packages/change-log/src/index.ts"
import { flatten,type Id,type Run } from "../../../../packages/deck/src/index.ts"
import type { Pending } from "../../../../packages/rpc/src/outbox.ts"
import { Slide } from "../../../../packages/render/src/index.ts"
import { deckAction } from "../decks/catalog-client.ts"
import { newSlide,orderedSlides,reviewPaste,selectSlides,type PasteReview } from "./editor-model.ts"
import { ExportDialog } from "../export/export-dialog.tsx"
import { fontManifest } from "../../../../packages/render/src/font-manifest.ts"
import { FontReadiness } from "../templates/font-readiness.tsx"
import { useDeck } from "./use-deck.ts"

const labels={saved:"Saved",pending:"Saving…",offline:"Offline · changes saved on this device",retrying:"Still offline · reconnect to save your changes",recovery:"Some changes need your attention",deleted:"This deck is in Trash. It is read-only. Your unsaved changes are kept on this device.","signed-out":"Sign in to the same account to save your changes."}
export function ManualEditor({deckId}:{deckId:string}) {
  const [chatOpen,setChatOpen]=useState(false)
  const [designOpen,setDesignOpen]=useState(false),[imagesOpen,setImagesOpen]=useState(false)
  const {sync,entry,setEntry,error,setError,reconnect}=useDeck(deckId)
  const [selection,setSelection]=useState<Id[]>([]),anchor=useRef<Id|null>(null)
  const [phone,setPhone]=useState(()=>window.matchMedia("(max-width: 767px)").matches)
  const [request,setRequest]=useState(()=>sessionStorage.getItem("first-pending-request") ?? ""),[requestStatus,setRequestStatus]=useState("")
  const [paste,setPaste]=useState<PasteReview|null>(null),[pasteSource,setPasteSource]=useState(""),[showPaste,setShowPaste]=useState(false)
  const [exportOpen,setExportOpen]=useState(false)
  const [view,setView]=useState<"grid"|"single">("grid"),[zoom,setZoom]=useState(100),[menu,setMenu]=useState(false),[contextMenu,setContextMenu]=useState(false)
  const [changesOpen,setChangesOpen]=useState(false)
  const deck=sync?.deck,state=sync?.state
  const readonly=phone || state?.kind==="deleted" || state?.kind==="signed-out"
  useEffect(()=>{if(entry?.pendingRequest)setRequest(entry.pendingRequest)},[entry?.pendingRequest])
  useEffect(()=>{const media=window.matchMedia("(max-width: 767px)"),change=()=>setPhone(media.matches);media.addEventListener("change",change);return ()=>media.removeEventListener("change",change)},[])
  const send=useCallback((command:Command)=>{if(!sync || readonly)return;void sync.enqueue(command).catch(failure=>setError(String(failure)))},[sync,readonly,setError])
  function edit(changes:Extract<Command,{kind:"edit"}>["changes"]) {if(sync)send({id:commandId(crypto.randomUUID()),kind:"edit",base:sync.seq,run:null,changes})}
  const history=useCallback((direction:"undo"|"redo")=>{const target=sync?.historyTarget(direction);if(target)send({id:commandId(crypto.randomUUID()),kind:direction,target})},[sync,send])
  function select(target:Id,event:MouseEvent) {if(!deck)return;setSelection(current=>selectSlides(deck,current,target,anchor.current,event.shiftKey,event.ctrlKey||event.metaKey));if(!event.shiftKey)anchor.current=target}
  const text=useCallback((target:Id,runs:[Run,...Run[]])=>{if(sync)send({id:commandId(crypto.randomUUID()),kind:"patch",target,fields:{runs:runs.map(run=>({...run}))},base:sync.seq,run:null})},[sync,send])
  async function saveRequest() {try{setEntry(await deckAction(deckId,"request",{pendingRequest:request}));await airaRequest(deckId,"send",{text:request,selection:[]});sessionStorage.removeItem("first-pending-request");setRequestStatus("Aira is working. You can keep editing.");setChatOpen(true)}catch(failure){setError(String(failure))}}
  function addSlide() {if(!deck)return;const slide=newSlide(deck);edit({changes:[{kind:"insert",parent:deck.id,index:deck.slides.length,value:slide}]});setSelection([slide.id]);anchor.current=slide.id}
  function reorder(direction:-1|1) {if(!deck)return;const order=orderedSlides(deck,selection,direction);edit({changes:order.map((target,index)=>({kind:"move",target,parent:deck.id,index}))})}
  function insertPaste() {if(!deck || !paste)return;edit({changes:paste.accepted.map((slide,index)=>({kind:"insert",parent:deck.id,index:deck.slides.length+index,value:slide}))});setSelection(paste.accepted.map(slide=>slide.id));setPaste(null);setShowPaste(false)}
  async function recover(item:Extract<Pending,{kind:"rejected"}>) {
    if(!sync || !item.restore || readonly || (item.command.kind!=="edit" && item.command.kind!=="patch"))return
    const suffix=crypto.randomUUID()
    try{await sync.recover(item.command.id,[{id:commandId(`restore_${suffix}`),kind:"undo",target:item.restore},{...item.command,id:commandId(`retry_${suffix}`),base:sync.seq}])}catch(failure){setError(String(failure))}
  }
  const actions=()=> <>
    <button type="button" disabled={readonly||!sync?.historyTarget("undo")} onPointerDown={event=>event.preventDefault()} onClick={()=>history("undo")}>Undo</button>
    <button type="button" disabled={readonly||!sync?.historyTarget("redo")} onPointerDown={event=>event.preventDefault()} onClick={()=>history("redo")}>Redo</button>
    <button type="button" disabled={readonly||!selection.length} onClick={()=>reorder(-1)}>Move earlier</button>
    <button type="button" disabled={readonly||!selection.length} onClick={()=>reorder(1)}>Move later</button>
    <button type="button" disabled={readonly||!selection.length} onClick={()=>edit({changes:selection.map(target=>({kind:"remove",target}))})}>Delete slides</button>
    <button type="button" disabled={readonly} onClick={()=>setShowPaste(true)}>Paste slides</button>
  </>
  return <section className="studio-editor" data-chat={chatOpen} data-view={view} data-sync-state={state?.kind ?? "loading"} data-seq={sync?.seq ?? 0} data-font-manifest={JSON.stringify(fontManifest)} onPointerDown={event=>{if(event.target instanceof Element && !event.target.closest(".deck-menu"))setMenu(false);if(event.target instanceof Element && !event.target.closest(".editor-context"))setContextMenu(false)}} onKeyDown={event=>{
    if(event.defaultPrevented)return
    const field=event.target instanceof HTMLElement && !!event.target.closest('input,textarea,[contenteditable="true"]')
    if(!field && (event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="z"){event.preventDefault();history(event.shiftKey ? "redo" : "undo")}
    else if(!readonly && !field && (event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="v"){event.preventDefault();setShowPaste(true)}
    else if(!field && (event.key==="Delete"||event.key==="Backspace")){event.preventDefault();edit({changes:selection.map(target=>({kind:"remove",target}))})}
    else if(!field && event.altKey && (event.key==="ArrowLeft"||event.key==="ArrowRight")){event.preventDefault();reorder(event.key==="ArrowLeft" ? -1 : 1)}
    else if(event.key==="Escape"){setMenu(false);setContextMenu(false)}
  }}>
    <header className="editor-bar">
      <a className="editor-logo" href="/" aria-label="Home">A</a>
      <div className="deck-menu"><button type="button" className="deck-name" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{entry?.title ?? "Opening deck…"}⌄</button>{menu && <nav aria-label="Deck menu" className="editor-menu" onClick={()=>setMenu(false)}><a href="/">Back to Home</a>{actions()}</nav>}</div>
      <Button size="compact" variant="secondary" disabled={!deck||readonly} onClick={addSlide}>+ New slide</Button>
      <div className="editor-view" aria-label="Slide view"><button type="button" aria-label="Single slide view" aria-pressed={view==="single"} onClick={()=>{setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id])}}>▣</button><button type="button" aria-label="Grid view" aria-pressed={view==="grid"} onClick={()=>setView("grid")}>⊞</button></div>
    </header>
    <aside className="editor-export"><label><span className="sr-only">Zoom</span><select aria-label="Zoom" value={zoom} onChange={event=>setZoom(Number(event.target.value))}>{[50,75,100,125,150].map(value=><option key={value} value={value}>{value}%</option>)}</select></label><Button size="compact" variant="primary" disabled={state?.kind!=="saved"||readonly||!deck?.slides.length} onClick={()=>setExportOpen(true)}>Export</Button></aside>
    <FontReadiness/>
    <p role="status" className="editor-status">{phone ? "Edit on a laptop · read-only viewing" : error && state?.kind==="pending" ? copy("editor.save_failed_title") : state ? labels[state.kind] : "Opening your saved deck…"}{selection.length>0 ? ` · ${selection.length} selected` : ""}</p>
    {error && <EditorErrorNotice saving={sync!==null} retry={reconnect}/>}
    {(state?.kind==="offline"||state?.kind==="retrying") && <Button size="compact" variant="secondary" onClick={reconnect}>Reconnect</Button>}
    {state?.kind==="deleted" && <Button size="compact" variant="secondary" onClick={()=>void deckAction(deckId,"restore").then(()=>location.reload()).catch(failure=>setError(String(failure)))}>Restore deck</Button>}
    {contextMenu && <nav className="editor-context editor-menu" aria-label="Slide actions">{actions()}<button type="button" onClick={()=>setContextMenu(false)}>Close menu</button></nav>}
    {!phone && <nav className="editor-dock" aria-label="Design tools"><button type="button" aria-label="Select slides" aria-pressed={view==="grid"} onClick={()=>setView("grid")}>↖</button><button type="button" aria-label="Edit slide text" aria-pressed={view==="single"} onClick={()=>{setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id])}}>T</button><button type="button" disabled title="Shape tools are not available yet">◇</button><button type="button" aria-label="Images" aria-pressed={imagesOpen} onClick={()=>{setImagesOpen(!imagesOpen);setDesignOpen(false)}}>▧</button><button type="button" disabled title="Components are not available yet">⊞</button><span className="dock-divider"/><button type="button" aria-pressed={chatOpen} onClick={()=>{setChatOpen(!chatOpen);setDesignOpen(false);setImagesOpen(false)}}>Agent</button><button type="button" aria-pressed={designOpen} onClick={()=>{setDesignOpen(!designOpen);setImagesOpen(false)}}>Design</button></nav>}
    {phone && <Button size="compact" variant="secondary" onClick={()=>setChatOpen(!chatOpen)}>View Aira</Button>}
    {chatOpen && deck && <ChatPanel deck={deck} selection={selection} readonly={readonly} close={()=>setChatOpen(false)}/>}
    {imagesOpen && deck && <ImagePanel deck={deck} slideId={selection[0]} disabled={readonly||state?.kind!=="saved"} close={()=>setImagesOpen(false)}/>}
    {designOpen && deck && <TemplatePanel deck={deck} disabled={readonly||state?.kind!=="saved"} close={()=>setDesignOpen(false)}/>}
    {!deck?.slides.length && !readonly && <section className="editor-first-request"><h2>What would you like to make?</h2><p>Describe your deck, or add a slide and start editing.</p><label htmlFor="first-request">Your first request</label><textarea id="first-request" value={request} onChange={event=>{setRequest(event.target.value);sessionStorage.setItem("first-pending-request",event.target.value)}}/><Button size="dialog" variant="primary" onClick={()=>void saveRequest()} disabled={!request.trim()}>Build with Aira</Button><p role="status">{requestStatus || (entry?.pendingRequest ? "Your request is saved. Send it to Aira when ready." : "Aira uses weekly usage. You can also edit by hand.")}</p></section>}
    <section className="editor-section" aria-label="Slides section"><h2>Slides</h2>
    <div className="editor-slides" aria-label="Slides" style={{maxInlineSize:view==="single" ? `${960*zoom/100}px` : undefined,gridTemplateColumns:view==="grid" ? `repeat(auto-fill,minmax(min(100%,${300*zoom/100}px),1fr))` : undefined}} onContextMenu={event=>{event.preventDefault();setContextMenu(true)}}>
      {deck?.slides.map((slide,index)=><article key={slide.id} className="editor-slide" hidden={view==="single" && slide.id!==(selection[0] ?? deck.slides[0]?.id)} data-selected={selection.includes(slide.id)} onContextMenu={()=>{if(!selection.includes(slide.id))setSelection([slide.id])}}>
        <button className="slide-select" type="button" aria-pressed={selection.includes(slide.id)} onDoubleClick={()=>{setSelection([slide.id]);setView("single")}} onClick={event=>select(slide.id,event)}>Slide {index+1}</button>
        <div className="slide-preview" style={{aspectRatio:`${slide.size.width}/${slide.size.height}`}}><div className="slide-canvas" style={{inlineSize:slide.size.width,blockSize:slide.size.height,zoom:`calc(100cqi / ${slide.size.width}px)`}}><Slide slide={slide} themes={deck.themes} {...(readonly ? {} : {commitText:text,historyText:history})}/></div></div>
        {flatten(slide.elements).filter(element=>element.support.kind!=="native").map(element=><p key={element.id} className="slide-disclosure">{element.support.kind==="kept" ? "Kept original · preview unavailable" : element.support.kind==="flagged" ? `Flagged: ${element.support.reason}` : ""}</p>)}
      </article>)}
    </div></section>
    {!readonly && deck && selection.length===1 && <label className="editor-notes" htmlFor="speaker-notes">Speaker notes</label>}{!readonly && deck && selection.length===1 && <textarea className="editor-notes" id="speaker-notes" aria-label="Speaker notes" value={deck.slides.find(slide=>selection.includes(slide.id))?.notes ?? ""} onChange={event=>{const target=selection[0];if(sync && target)send({id:commandId(crypto.randomUUID()),kind:"patch",target,fields:{notes:event.target.value},base:sync.seq,run:null})}}/>}
    {sync && <details className="editor-changes" onToggle={event=>setChangesOpen(event.currentTarget.open)}><summary>Changes by slide</summary>{changesOpen&&<ol>{sync.history.events.map(event=><li key={event.id}>{event.actor==="person" ? "You" : "Agent"}: {event.patches.map(patch=>patch.id).join(", ")} · {event.active ? "Applied" : "Undone"} <Button size="compact" variant="secondary" disabled={readonly||!event.active} onClick={()=>send({id:commandId(crypto.randomUUID()),kind:"undo",target:event.id})}>Undo change</Button></li>)}</ol>}</details>}
    {sync?.queue.filter(item=>item.kind==="rejected").map(item=><section key={item.command.id} role="alert"><p>Change needs attention. {item.kind==="rejected" ? item.code : ""}. The original change is kept on this device.</p>{item.restore && <Button size="compact" variant="primary" disabled={readonly||state?.kind==="offline"||state?.kind==="retrying"} onClick={()=>void recover(item)}>Restore deleted slide and retry</Button>}<details><summary>Original change</summary><pre>{JSON.stringify(item.command,null,2)}</pre></details><Button size="compact" variant="secondary" onClick={()=>void sync.dismiss(item.command.id)}>Discard change</Button></section>)}
    {showPaste && <section className="paste-review"><h2>Paste slides</h2><label htmlFor="paste-source">Original slide JSON</label><textarea id="paste-source" aria-label="Original slide JSON" value={pasteSource} onChange={event=>setPasteSource(event.target.value)}/><Button size="dialog" variant="secondary" onClick={()=>setPaste(reviewPaste(pasteSource))}>Review paste</Button><Button size="dialog" variant="secondary" onClick={()=>setShowPaste(false)}>Close paste</Button></section>}
    <AlertDialog open={paste!==null} title="Review your paste" body={paste ? `${paste.accepted.length} slides accepted. ${paste.refused.join(" ") || "No slides refused."} Your original paste stays in the field.` : ""} onClose={()=>setPaste(null)} secondary={{label:"Cancel"}} {...(paste?.accepted.length ? {primary:{label:"Insert accepted slides",onClick:insertPaste}} : {})}/>
    {deck && sync && <ExportDialog disabled={readonly||state?.kind!=="saved"} deck={deck} seq={sync.seq} open={exportOpen} close={()=>setExportOpen(false)} fix={slide=>{setSelection([slide]);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.editor-slide[data-selected="true"] .slide-select')?.focus())}}/>}
  </section>
}
