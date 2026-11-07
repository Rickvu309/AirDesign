import {formatRuns} from "../../../../packages/render/src/text-format.ts"
import "./editor.css"
import {slideSections} from "./slide-sections.ts"
import {EditorIcon} from "./editor-icon.tsx"
import {useAiraSnapshot} from "../chat/use-aira-snapshot.ts"
import {runSlideStates} from "./run-progress.ts"
import {ChatPanel} from "../chat/chat-panel.tsx"
import {airaRequest} from "../chat/aira-client.ts"
import { ImagePanel } from "../images/image-panel.tsx"
import { TemplatePanel } from "../templates/template-panel.tsx"
import { Fragment,useCallback,useEffect,useRef,useState,type MouseEvent } from "react"
import { AlertDialog,BrandMark,Icon,Button,toast } from "@airdesign/ui"
import { commandId,type Command } from "../../../../packages/change-log/src/index.ts"
import { flatten,type Element as DeckElement,type Id,type Box,type Slide,type Run } from "../../../../packages/deck/src/index.ts"
import type { Pending } from "../../../../packages/rpc/src/outbox.ts"
import { deckAction } from "../decks/catalog-client.ts"
import { insertionAnchor,clipboardSource,fitToolElement,newSlide,orderedSlides,reviewPaste,selectSlides,type SlideLayout,type PasteReview } from "./editor-model.ts"
import { ExportDialog } from "../export/export-dialog.tsx"
import { fontManifest } from "../../../../packages/render/src/font-manifest.ts"
import { FontReadiness } from "../templates/font-readiness.tsx"
import { EditorTools, type EditorTool } from "./editor-tools.tsx"
import { SlidePreview } from "./slide-preview.tsx"
import { useDeck } from "./use-deck.ts"

const labels={saved:"Saved",pending:"Saving…",offline:"You're offline. Edits are saved on this device.",retrying:"Still offline · reconnect to save your changes",recovery:"Some changes need your attention",deleted:"This deck is in Trash. It is read-only. Your unsaved changes are kept on this device.","signed-out":"Sign in to the same account to save your changes."}
export function ManualEditor({deckId}:{deckId:string}) {
  const editorRef=useRef<HTMLElement>(null)
  const [tool,setTool]=useState<EditorTool>("none")
  const hold=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),held=useRef(false)
  const {snapshot}=useAiraSnapshot(deckId)
  const run=snapshot?.run ?? null
  const [chatOpen,setChatOpen]=useState(false)
  const [designOpen,setDesignOpen]=useState(false),[imagesOpen,setImagesOpen]=useState(false)
  const {sync,entry,setEntry,error,setError,reconnect}=useDeck(deckId)
  const [requestedSelection,setSelection]=useState<Id[]>([]),anchor=useRef<Id|null>(null)
  const [objectSelection,setObjectSelection]=useState<{slide:Id;element:Id}|null>(null)
  const [phone,setPhone]=useState(()=>window.matchMedia("(max-width: 767px)").matches)
  const [request,setRequest]=useState(()=>sessionStorage.getItem("first-pending-request") ?? ""),[requestStatus,setRequestStatus]=useState("")
  const [paste,setPaste]=useState<PasteReview|null>(null),[pasteSource,setPasteSource]=useState(""),[showPaste,setShowPaste]=useState(false)
  const [exportOpen,setExportOpen]=useState(false)
  const [view,setView]=useState<"grid"|"single">("grid"),[zoom,setZoom]=useState(100),[menu,setMenu]=useState(false),[contextMenu,setContextMenu]=useState(false)
  const [changesOpen,setChangesOpen]=useState(false)
  const deck=sync?.deck,state=sync?.state
  const survivingSelection=requestedSelection.filter(id=>deck?.slides.some(slide=>slide.id===id))
  const selection=survivingSelection.length ? survivingSelection : deck?.slides[0] ? [deck.slides[0].id] : []
  const selectedSlide=deck?.slides.find(slide=>slide.id===selection[0])
  const selectedObject=objectSelection?.slide===selectedSlide?.id ? flatten(selectedSlide?.elements ?? []).find(element=>element.id===objectSelection?.element) : undefined
  const runStates=deck ? runSlideStates(deck,run) : new Map()
  const readonly=phone || state?.kind==="deleted" || state?.kind==="signed-out"
  useEffect(()=>{if(entry?.pendingRequest)setRequest(entry.pendingRequest)},[entry?.pendingRequest])
  useEffect(()=>{const media=window.matchMedia("(max-width: 767px)"),change=()=>setPhone(media.matches);media.addEventListener("change",change);return ()=>media.removeEventListener("change",change)},[])
  const send=useCallback((command:Command)=>{if(!sync || readonly)return;void sync.enqueue(command).catch(failure=>setError(String(failure)))},[sync,readonly,setError])
  function edit(changes:Extract<Command,{kind:"edit"}>["changes"]) {if(sync)send({id:commandId(crypto.randomUUID()),kind:"edit",base:sync.seq,run:null,changes})}
  useEffect(()=>()=>clearTimeout(hold.current),[])
  const history=useCallback((direction:"undo"|"redo")=>{const target=sync?.historyTarget(direction);if(target)send({id:commandId(crypto.randomUUID()),kind:direction,target})},[sync,send])
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.defaultPrevented)return;const field=event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]');if(!field&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="z"){event.preventDefault();history(event.shiftKey ? "redo" : "undo")}};document.addEventListener("keydown",key);return ()=>document.removeEventListener("keydown",key)},[history])
  function insertElement(element:DeckElement) {const slide=deck?.slides.find(slide=>slide.id===selection[0]) ?? deck?.slides[0];if(!slide)return;edit({changes:[{kind:"insert",parent:slide.id,index:slide.elements.length,value:fitToolElement(element,slide.size)}]});setSelection([slide.id]);setObjectSelection({slide:slide.id,element:element.id});setView("single")}
  function geometry(target:Id,box:Box) {if(sync)send({id:commandId(crypto.randomUUID()),kind:"patch",target,fields:{box},base:sync.seq,run:null})}
  function removeSlides() {edit({changes:selection.map(target=>({kind:"remove",target}))});editorRef.current?.focus()}
  function insertSlides(slides:Slide[],message:string) {
    if(!deck || !sync)return
    const slot=insertionAnchor(deck,selection),target=commandId(crypto.randomUUID())
    send({id:target,kind:"edit",base:sync.seq,run:null,changes:{changes:slides.map((slide,index)=>({kind:"insert",parent:deck.id,index:slot.index+index,value:{...slide,section:slot.section ?? slide.section}}))}})
    setSelection(slides.map(slide=>slide.id));anchor.current=slides.at(-1)?.id ?? null
    toast.success(message,{action:{label:"Undo",onClick:()=>send({id:commandId(crypto.randomUUID()),kind:"undo",target})}})
  }
  function pasteSlides(source:string) {const review=reviewPaste(source);if(!deck)return;if(!review.accepted.length || review.refused.length){setPasteSource(source);setPaste(review);return}insertSlides(review.accepted,`${review.accepted.length} ${review.accepted.length===1 ? "slide" : "slides"} pasted`)}
  async function readClipboard() {try{pasteSlides(await navigator.clipboard.readText())}catch{setShowPaste(true)}}
  async function copySlides() {if(!deck || !selection.length)return;try{await navigator.clipboard.writeText(clipboardSource(deck,selection))}catch{setError("Clipboard unavailable. Allow clipboard access and try again.")}}
  function select(target:Id,event:MouseEvent) {if(!deck)return;setSelection(current=>selectSlides(deck,current,target,anchor.current,event.shiftKey,event.ctrlKey||event.metaKey));if(!event.shiftKey)anchor.current=target}
  const text=useCallback((target:Id,runs:[Run,...Run[]])=>{if(sync)send({id:commandId(crypto.randomUUID()),kind:"patch",target,fields:{runs:runs.map(run=>({...run}))},base:sync.seq,run:null})},[sync,send])
  async function saveRequest() {try{setEntry(await deckAction(deckId,"request",{pendingRequest:request}));await airaRequest(deckId,"send",{text:request,selection:[]});sessionStorage.removeItem("first-pending-request");setRequestStatus("Aira is working. You can keep editing.");setChatOpen(true)}catch(failure){setError(String(failure))}}
  function addSlide(layout:SlideLayout="title") {if(deck)insertSlides([newSlide(deck,layout)],"Slide added")}
  function reorder(direction:-1|1) {if(!deck)return;const order=orderedSlides(deck,selection,direction);edit({changes:order.map((target,index)=>({kind:"move",target,parent:deck.id,index}))})}
  function insertPaste() {if(!paste?.accepted.length)return;insertSlides(paste.accepted,`${paste.accepted.length} slides pasted`);setPaste(null);setShowPaste(false)}
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
    <button type="button" disabled={readonly||!selection.length} onClick={removeSlides}>Delete slides</button>
    <button type="button" disabled={readonly} onClick={()=>void readClipboard()}>Paste slides</button>
    <button type="button" onClick={()=>setChangesOpen(!changesOpen)}>Review changes</button>
  </>
  return <section ref={editorRef} tabIndex={-1} onPaste={event=>{if(readonly || event.target instanceof HTMLElement && event.target.closest('input,textarea,[contenteditable="true"]'))return;const source=event.clipboardData.getData("text/plain");if(source){event.preventDefault();pasteSlides(source)}}} className="studio-editor" data-chat={chatOpen} data-design={designOpen} data-images={imagesOpen} data-tool={tool} data-view={view} data-sync-state={state?.kind ?? "loading"} data-seq={sync?.seq ?? 0} data-font-manifest={JSON.stringify(fontManifest)} onPointerDown={event=>{if(event.target instanceof Element && !event.target.closest(".deck-menu"))setMenu(false);if(event.target instanceof Element && !event.target.closest(".editor-context"))setContextMenu(false)}} onKeyDown={event=>{
    if(event.defaultPrevented)return
    const field=event.target instanceof HTMLElement && !!event.target.closest('input,textarea,[contenteditable="true"]')
    if(!field && (event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="z"){event.preventDefault();history(event.shiftKey ? "redo" : "undo")}
    else if(!field && selectedObject && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key) && !event.altKey){event.preventDefault();const distance=event.shiftKey ? 10 : 1;geometry(selectedObject.id,{...selectedObject.box,x:selectedObject.box.x+(event.key==="ArrowLeft" ? -distance : event.key==="ArrowRight" ? distance : 0),y:selectedObject.box.y+(event.key==="ArrowUp" ? -distance : event.key==="ArrowDown" ? distance : 0)})}
    else if(!field && selectedObject && (event.key==="Delete"||event.key==="Backspace")){event.preventDefault();edit({changes:[{kind:"remove",target:selectedObject.id}]});setObjectSelection(null)}
    else if(!field && (event.key==="Delete"||event.key==="Backspace")){event.preventDefault();removeSlides()}
    else if(!field && event.altKey && (event.key==="ArrowLeft"||event.key==="ArrowRight")){event.preventDefault();reorder(event.key==="ArrowLeft" ? -1 : 1)}
    else if(!field && (event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="c"){event.preventDefault();void copySlides()}
    else if(event.key==="Escape"){setMenu(false);setContextMenu(false);setTool("none");setObjectSelection(null)}
  }}>
    <header className="editor-bar">
      <a className="editor-logo" href="/" aria-label="Home"><BrandMark/></a>
      <div className="deck-menu"><button type="button" className="deck-name" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{entry?.title ?? "Opening deck…"}⌄</button>{menu && <nav aria-label="Deck menu" className="editor-menu" onClick={()=>setMenu(false)}><a href="/">Back to Home</a>{actions()}</nav>}</div>
      <Button size="compact" variant="secondary" disabled={!deck||readonly} title="Click to add a slide. Hold or press Down to choose a layout." onContextMenu={event=>{event.preventDefault();setTool("layouts")}} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();setTool("layouts")}}} onPointerDown={event=>{if(event.button!==0)return;held.current=false;hold.current=setTimeout(()=>{held.current=true;setTool("layouts")},450)}} onPointerUp={()=>clearTimeout(hold.current)} onPointerCancel={()=>clearTimeout(hold.current)} onPointerLeave={()=>clearTimeout(hold.current)} onClick={()=>{if(!held.current)addSlide()}}>+ New slide</Button>
      <div className="editor-view" aria-label="Slide view"><button type="button" aria-label="Single slide view" aria-pressed={view==="single"} onClick={()=>{setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id])}}><EditorIcon name="slide"/></button><button type="button" aria-label="Grid view" aria-pressed={view==="grid"} onClick={()=>setView("grid")}><Icon name="grid"/></button></div>
    </header>
    <aside className="editor-export"><label><span className="sr-only">Zoom</span><select aria-label="Zoom" value={zoom} onChange={event=>setZoom(Number(event.target.value))}>{[50,75,100,125,150].map(value=><option key={value} value={value}>{value}%</option>)}</select></label><Button size="compact" variant="primary" disabled={state?.kind!=="saved"||readonly||!deck?.slides.length} onClick={()=>setExportOpen(true)}>Export</Button></aside>
    {view==="single" && selectedObject?.kind==="text" && <div className="text-format-toolbar" role="toolbar" aria-label="Text formatting">{(["bold","italic","underline"] as const).map(format=><button type="button" key={format} aria-label={format.charAt(0).toUpperCase()+format.slice(1)} aria-pressed={selectedObject.runs.every(run=>Boolean(run[format]))} onPointerDown={event=>event.preventDefault()} onClick={()=>{const field=document.activeElement;if(field instanceof HTMLElement && field.isContentEditable)field.dispatchEvent(new CustomEvent("airdesign-format",{detail:format}));else text(selectedObject.id,formatRuns(selectedObject.runs,format,0,selectedObject.runs.reduce((sum,run)=>sum+run.text.length,0)))}}>{format==="bold" ? "B" : format==="italic" ? "I" : "U"}</button>)}</div>}
    <FontReadiness/>
    <p role="status" className="editor-status">{state?.kind==="offline"||state?.kind==="retrying" ? labels[state.kind] : phone ? "Edit on a laptop · read-only viewing" : state ? labels[state.kind] : "Opening your saved deck…"}{selection.length>0 && state?.kind!=="offline" && state?.kind!=="retrying" ? ` · ${selection.length} selected` : ""}{(state?.kind==="offline"||state?.kind==="retrying")&&<Button size="compact" variant="secondary" onClick={reconnect}>Reconnect</Button>}</p>
    {error && <p role="alert">{error} <a href="/">Back to Home</a></p>}
    {state?.kind==="deleted" && <Button size="compact" variant="secondary" onClick={()=>void deckAction(deckId,"restore").then(()=>location.reload()).catch(failure=>setError(String(failure)))}>Restore deck</Button>}
    {contextMenu && <nav className="editor-context editor-menu" aria-label="Slide actions">{actions()}<button type="button" onClick={()=>setContextMenu(false)}>Close menu</button></nav>}
    {!phone && <nav className="editor-dock" aria-label="Design tools"><button type="button" aria-label="Select slides" aria-pressed={view==="grid"} onClick={()=>setView("grid")}><EditorIcon name="cursor"/></button><button type="button" aria-label="Edit slide text" aria-pressed={tool==="text"} onClick={()=>{setTool(tool==="text" ? "none" : "text");setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id])}}><EditorIcon name="text"/></button><button type="button" aria-label="Shapes" aria-pressed={tool==="shapes"} onClick={()=>{setTool(tool==="shapes" ? "none" : "shapes");setImagesOpen(false);setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id])}}><EditorIcon name="shape"/></button><button type="button" aria-label="Images" aria-pressed={imagesOpen} onClick={()=>{setImagesOpen(!imagesOpen);setDesignOpen(false);setTool("none");setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id])}}><EditorIcon name="image"/></button><button type="button" aria-label="Actions" aria-pressed={tool==="actions"} onClick={()=>{setTool(tool==="actions" ? "none" : "actions");setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id])}}><EditorIcon name="actions"/></button><span className="dock-divider"/><button type="button" aria-pressed={chatOpen} onClick={()=>{setChatOpen(!chatOpen);setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id]);setDesignOpen(false);setImagesOpen(false)}}>Agent</button><button type="button" aria-pressed={designOpen} onClick={()=>{setDesignOpen(!designOpen);setImagesOpen(false);setTool("none");setChatOpen(false);setView("single");if(!selection.length && deck?.slides[0])setSelection([deck.slides[0].id])}}>Design</button></nav>}
    {!readonly && deck && (tool!=="layouts"||!deck.slides.length) && <EditorTools key={tool} tool={tool} close={()=>setTool("none")} insert={insertElement} addSlide={addSlide} deck={deck}/>}
    {phone && <Button size="compact" variant="secondary" onClick={()=>setChatOpen(!chatOpen)}>View Aira</Button>}
    {chatOpen && deck && <ChatPanel snapshot={snapshot} title={entry?.title} deck={deck} selection={selectedObject&&selectedSlide ? [selectedSlide.id,selectedObject.id] : selection} detach={()=>setObjectSelection(null)} readonly={readonly} connected={state?.kind!=="offline" && state?.kind!=="retrying"} close={()=>setChatOpen(false)}/>}
    {imagesOpen && deck && <ImagePanel deck={deck} slideId={selection[0]} disabled={readonly||state?.kind!=="saved"} close={()=>setImagesOpen(false)}/>}
    {designOpen && deck && <TemplatePanel key={selection.join(",")} deck={deck} selection={selection} edit={edit} disabled={readonly||state?.kind!=="saved"} close={()=>setDesignOpen(false)}/>}
    {!deck?.slides.length && !readonly && <section className="editor-first-request"><h2>What would you like to make?</h2><p>Describe your deck, or add a slide and start editing.</p><label htmlFor="first-request">Your first request</label><textarea id="first-request" value={request} onChange={event=>{setRequest(event.target.value);sessionStorage.setItem("first-pending-request",event.target.value)}}/><Button size="dialog" variant="primary" onClick={()=>void saveRequest()} disabled={!request.trim()}>Build with Aira</Button><p role="status">{requestStatus || (entry?.pendingRequest ? "Your request is saved. Send it to Aira when ready." : "Aira uses weekly usage. You can also edit by hand.")}</p></section>}
    {view==="single" && deck && <nav className="editor-filmstrip" aria-label="Slide navigation">{slideSections(deck.slides).map(section=><details key={section.slides[0]!.slide.id} open><summary>{section.name}</summary>{section.slides.map(({slide,number})=><button type="button" key={slide.id} aria-label={`Go to slide ${number}`} aria-current={selection[0]===slide.id ? "page" : undefined} onClick={()=>setSelection([slide.id])}><span>{number}</span><SlidePreview slide={slide} themes={deck.themes}/>{runStates.get(slide.id)==="queued"&&<span className="slide-queued">Queued</span>}</button>)}</details>)}</nav>}

    {slideSections(deck?.slides ?? []).map(section=><section className="editor-section" key={section.slides[0]!.slide.id} aria-label={`${section.name} section`}><h2>{section.name}</h2>
    <div className="editor-slides" aria-label={section.name} style={{maxInlineSize:view==="single" ? `${800*zoom/100}px` : undefined,gridTemplateColumns:view==="grid" ? `repeat(auto-fill,minmax(min(100%,${300*zoom/100}px),${300*zoom/100}px))` : undefined}} onContextMenu={event=>{event.preventDefault();setContextMenu(true)}}>
      {section.slides.map(({slide,number})=><Fragment key={slide.id}><article className="editor-slide" data-run-state={runStates.get(slide.id)} hidden={view==="single" && slide.id!==(selection[0] ?? deck?.slides[0]?.id)} data-selected={selection.includes(slide.id)} onContextMenu={()=>{if(!selection.includes(slide.id))setSelection([slide.id])}}>
        <button className="slide-select" type="button" aria-pressed={selection.includes(slide.id)} onDoubleClick={()=>{setSelection([slide.id]);setView("single")}} onClick={event=>select(slide.id,event)} aria-label={`Slide ${number}`}>{number}</button>
        <SlidePreview slide={slide} themes={deck?.themes ?? []} {...(readonly || view==="grid" ? {} : {commitText:text,historyText:history,editing:{selected:selectedObject?.id ?? null,select:element=>setObjectSelection({slide:slide.id,element}),geometry}})}/>
        {flatten(slide.elements).filter(element=>element.support.kind!=="native").map(element=><p key={element.id} className="slide-disclosure">{element.support.kind==="kept" ? "Kept original · preview unavailable" : element.support.kind==="flagged" ? `Flagged: ${element.support.reason}` : ""}</p>)}
      </article>{tool==="layouts" && deck && deck.slides[insertionAnchor(deck,selection).index-1]?.id===slide.id && <div className="contextual-insertion"><EditorTools tool="layouts" close={()=>setTool("none")} insert={insertElement} addSlide={layout=>{addSlide(layout);setTool("none")}} deck={deck}/></div>}</Fragment>)}
    </div></section>)}

    {!readonly && view==="single" && deck && selection.length===1 && <label className="sr-only" htmlFor="speaker-notes">Speaker notes</label>}{!readonly && view==="single" && deck && selection.length===1 && <textarea className="editor-notes" id="speaker-notes" aria-label="Speaker notes" placeholder="Add speaker notes" value={deck.slides.find(slide=>selection.includes(slide.id))?.notes ?? ""} onChange={event=>{const target=selection[0];if(sync && target)send({id:commandId(crypto.randomUUID()),kind:"patch",target,fields:{notes:event.target.value},base:sync.seq,run:null})}}/>}
    {sync && <details className="editor-changes" open={changesOpen} onToggle={event=>setChangesOpen(event.currentTarget.open)}><summary>Changes by slide</summary>{changesOpen&&<ol>{sync.history.events.map(event=><li key={event.id}>{event.actor==="person" ? "You" : "Agent"}: {event.patches.map(patch=>patch.id).join(", ")} · {event.active ? "Applied" : "Undone"} <Button size="compact" variant="secondary" disabled={readonly||!event.active} onClick={()=>send({id:commandId(crypto.randomUUID()),kind:"undo",target:event.id})}>Undo change</Button></li>)}</ol>}</details>}
    {sync?.queue.filter(item=>item.kind==="rejected").map(item=><section key={item.command.id} role="alert"><p>Change needs attention. {item.kind==="rejected" ? item.code : ""}. The original change is kept on this device.</p>{item.restore && <Button size="compact" variant="primary" disabled={readonly||state?.kind==="offline"||state?.kind==="retrying"} onClick={()=>void recover(item)}>Restore deleted slide and retry</Button>}<details><summary>Original change</summary><pre>{JSON.stringify(item.command,null,2)}</pre></details><Button size="compact" variant="secondary" onClick={()=>void sync.dismiss(item.command.id)}>Discard change</Button></section>)}
    {showPaste && <section className="paste-review"><h2>Paste slides</h2><label htmlFor="paste-source">Original slide JSON</label><textarea id="paste-source" aria-label="Original slide JSON" value={pasteSource} onChange={event=>setPasteSource(event.target.value)}/><Button size="dialog" variant="secondary" onClick={()=>setPaste(reviewPaste(pasteSource))}>Review paste</Button><Button size="dialog" variant="secondary" onClick={()=>setShowPaste(false)}>Close paste</Button></section>}
    <AlertDialog open={paste!==null} title="Review your paste" body={paste ? `${paste.accepted.length} slides accepted. ${paste.refused.join(" ") || "No slides refused."} Your original paste stays in the field.` : ""} onClose={()=>setPaste(null)} secondary={{label:"Cancel"}} {...(paste?.accepted.length ? {primary:{label:"Insert accepted slides",onClick:insertPaste}} : {})}/>
    {deck && sync && <ExportDialog disabled={readonly||state?.kind!=="saved"} deck={deck} seq={sync.seq} open={exportOpen} close={()=>setExportOpen(false)} fix={slide=>{setSelection([slide]);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.editor-slide[data-selected="true"] .slide-select')?.focus())}}/>}
  </section>
}
