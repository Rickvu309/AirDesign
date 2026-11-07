import { useEffect, useRef, useState } from "react"
import { Button } from "@airdesign/ui"
import { applyTemplate, basics, newerVersion, type Template } from "../../../../packages/brand/src/index.ts"
import {flatten,type ChangeSet,type Deck,type Id } from "../../../../packages/deck/src/index.ts"
import {backgroundChanges,paletteChanges,slideBackground} from "../editor/design-changes.ts"
import { api } from "../decks/catalog-client.ts"
import "./templates.css"

export function TemplatePanel({deck,selection,edit,disabled,close}:{deck:Deck;selection:Id[];edit:(changes:ChangeSet)=>void;disabled:boolean;close:()=>void}) {
  const [picking,setPicking]=useState(false), [templates,setTemplates]=useState<Template[]>([...basics]), [selected,setSelected]=useState<Template>(basics[0]!), [query,setQuery]=useState(""), [mode,setMode]=useState<"apply-deck"|"insert-slide">("apply-deck"), [family,setFamily]=useState("basic"), [name,setName]=useState(""), [status,setStatus]=useState(""), [error,setError]=useState(""), [busy,setBusy]=useState(false), [substitute,setSubstitute]=useState(false), [defaultId,setDefaultId]=useState("")
  const trigger=useRef<HTMLButtonElement>(null),picker=useRef<HTMLElement>(null),search=useRef<HTMLInputElement>(null)
  function dismissPicker(){setPicking(false);trigger.current?.focus()}
  useEffect(()=>{
    if(!picking)return
    search.current?.focus()
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();dismissPicker()}}
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!picker.current?.contains(event.target)&&!trigger.current?.contains(event.target))dismissPicker()}
    document.addEventListener("keydown",key,true);document.addEventListener("pointerdown",outside)
    return ()=>{document.removeEventListener("keydown",key,true);document.removeEventListener("pointerdown",outside)}
  },[picking])
  async function load() { const value=await api<{templates:Template[];default:Template}>("/api/templates");setTemplates(value.templates);setDefaultId(`${value.default.id}:${value.default.version}`);return value }
  useEffect(()=>{void load().then(value=>{const pin=value.templates.find(template=>template.id===deck.template?.id && template.version===deck.template.version);if(pin)pick(pin)}).catch(failure=>setError(String(failure)))},[])
  const offer=newerVersion(deck,templates)
  const targets=selection.length ? selection : deck.slides.slice(0,1).map(slide=>slide.id)
  const slide=deck.slides.find(slide=>slide.id===targets[0])
  function colors(template:Template) {const primary=[template.foreground,template.accent,template.background,"#ffffff"].map(color=>color.toLowerCase());const mist=deck.slides.flatMap(slide=>flatten(slide.elements)).find(element=>element.support.kind==="native" && element.kind==="shape" && !primary.includes(element.fill.toLowerCase()));return [{name:"Navy",color:template.foreground},{name:"Teal",color:template.accent},{name:"Mist",color:mist?.kind==="shape" ? mist.fill : template.background},{name:"White",color:"#ffffff"}].map(item=>{const element=flatten(slide?.elements ?? []).find(element=>element.support.kind==="native" && (element.kind==="shape" ? element.fill===item.color : element.kind==="text" && element.runs.some(run=>run.color===item.color)));return {...item,target:element?.id,run:element?.kind==="text" ? element.runs.findIndex(run=>run.color===item.color) : -1}})}
  const [palette,setPalette]=useState(()=>colors(selected))
  function currentColor(item:typeof palette[number]) {const element=flatten(slide?.elements ?? []).find(element=>element.id===item.target);return element?.kind==="shape" ? element.fill : element?.kind==="text" ? element.runs[item.run]?.color ?? item.color : item.color}
  const preview=(()=>{try { return applyTemplate(deck,selected,{kind:"apply-deck"},family,substitute ? "Geist" : undefined) } catch {return null}})()
  async function action(path:string,body:unknown,message:string) {setBusy(true);setError("");try {const result=await api<{receipt?:{kind:string;code?:string}}>(path,body);if(result.receipt?.kind === "refused")throw new Error(result.receipt.code);setStatus(message);await load()}catch(failure){setError(String(failure))}finally{setBusy(false)}}
  function pick(template:Template) {if(picking)dismissPicker();setSelected(template);setFamily(template.families[0]!.id);setSubstitute(false);setStatus("");setPalette(colors(template))}
  return <section className="template-panel" aria-label="Design panel"><header><h2>Design</h2><Button variant="secondary" size="compact" onClick={close}>Close design</Button></header>
    {offer && <p className="template-offer" role="status">{offer.name} v{offer.version} is available. Your deck keeps v{deck.template?.version}. <button type="button" onClick={()=>pick(offer)}>Review newer version</button></p>}
    <h3>Template</h3><div className="template-current"><span className="template-colors">{[selected.foreground,selected.accent,selected.background].map(color=><span key={color} style={{background:color}}/>)}</span><span>{selected.name} · v{selected.version}<small>{selected.font}</small></span><Button ref={trigger} aria-label="Choose template" variant="secondary" size="compact" onClick={()=>setPicking(!picking)} aria-expanded={picking}>Choose template</Button></div>
    {picking && <section ref={picker} className="template-picker" aria-label="Template picker"><header><h2>Choose a look</h2><Button variant="secondary" size="compact" onClick={dismissPicker}>Close picker</Button></header>
    <label>Search templates<input ref={search} aria-label="Search templates" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search templates"/></label>
    <h3>Your templates</h3><div className="template-grid">{templates.filter(template=>!basics.some(basic=>basic.id===template.id)&&template.name.toLowerCase().includes(query.toLowerCase())).map(template=><TemplateCard key={`${template.id}:${template.version}`} template={template} selected={selected} pick={pick}/>)}</div>
    <h3>Basic</h3><div className="template-grid">{basics.filter(template=>template.name.toLowerCase().includes(query.toLowerCase())).map(template=><TemplateCard key={template.id} template={template} selected={selected} pick={pick}/>)}</div>
    </section>}
    <h3>Background</h3><label className="background-color">Slide background<input type="color" aria-label="Slide background" disabled={disabled||!slide} value={slide && (slideBackground(slide)?.fill || slide.background) || deck.themes.find(theme=>theme.id===slide?.theme)?.background || "#ffffff"} onChange={event=>edit(backgroundChanges(deck,targets,event.target.value))}/></label>
    <h3>Colors</h3><div className="template-palette">{palette.map((item,index)=><label key={item.name}>{item.name}<input type="color" aria-label={`${item.name} color`} disabled={disabled} value={currentColor(item)} onChange={event=>{edit(paletteChanges(deck,targets,currentColor(item),event.target.value));setPalette(current=>current.map((value,position)=>position===index ? {...value,color:event.target.value} : value))}}/></label>)}</div>
    <details className="template-advanced"><summary>Template options</summary>
    <h3>{selected.name} · v{selected.version}</h3>
    <label>Use this look<select value={mode} onChange={event=>setMode(event.target.value === "insert-slide" ? "insert-slide" : "apply-deck")}><option value="apply-deck">Apply to this deck</option><option value="insert-slide">Insert a new slide</option></select></label>
    <label>Layout family<select value={family} onChange={event=>setFamily(event.target.value)}>{selected.families.map(item=><option key={item.id} value={item.id}>{item.name} · {item.layouts.length} layouts</option>)}</select></label>
    {selected.fontRight === "missing" && <label>{selected.font} is missing. Choose a substitution before applying.<input type="checkbox" checked={substitute} onChange={event=>setSubstitute(event.target.checked)}/>Use Geist</label>}
    {selected.fontRight === "no-embedding" && <p role="status">{selected.font} cannot be embedded. PowerPoint may substitute it.</p>}
    {preview && <details><summary>{preview.retained.length} local overrides stay as they are</summary><ul>{preview.retained.map(item=><li key={item}>{item}</li>)}</ul></details>}
    <div className="template-actions"><Button variant="primary" size="dialog" disabled={disabled||busy||!preview} onClick={()=>void action("/api/templates/apply",{deck:deck.id,id:selected.id,version:selected.version,family,mode,slideId:`slide_${crypto.randomUUID().slice(0,20)}`,requestId:crypto.randomUUID(),...(substitute ? {substitution:"Geist"} : {})},mode === "apply-deck" ? "Look applied in one undo step." : "Slide inserted. Existing slides kept their look.")}>{mode === "apply-deck" ? "Apply to deck" : "Insert slide"}</Button>
    <Button variant="secondary" size="dialog" disabled={disabled||busy||selected.fontRight==="missing"||defaultId===`${selected.id}:${selected.version}`} onClick={()=>void action("/api/templates/default",{id:selected.id,version:selected.version},"Default saved for new decks. Existing decks keep their look.")}>{defaultId===`${selected.id}:${selected.version}` ? "Default for new decks" : "Make default"}</Button></div>
    <h3>Save this deck’s look</h3><label>Template name<input value={name} maxLength={100} onChange={event=>setName(event.target.value)}/></label><Button variant="secondary" size="dialog" disabled={disabled||busy||!name.trim()} onClick={()=>void action("/api/templates/from-deck",{deck:deck.id,id:`own_${crypto.randomUUID().slice(0,20)}`,name,version:1},"Template saved. Its version stays unchanged.")}>Save template</Button>
    {!basics.some(basic=>basic.id===selected.id) && <Button variant="secondary" size="dialog" disabled={disabled||busy} onClick={()=>void action("/api/templates/from-deck",{deck:deck.id,id:selected.id,name:name.trim()||selected.name,version:Math.max(...templates.filter(template=>template.id===selected.id).map(template=>template.version))+1},"New version saved. Existing decks keep their pinned version.")}>Save as next version</Button>}
    </details>
    {status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}
  </section>
}
function TemplateCard({template,selected,pick}:{template:Template;selected:Template;pick:(value:Template)=>void}) {
  const branded=!basics.some(basic=>basic.id===template.id)
  return <button type="button" className="template-card" aria-pressed={selected.id===template.id && selected.version===template.version} onClick={()=>pick(template)}><span className="template-sample" style={{background:branded ? template.foreground : template.background,color:branded ? template.background : template.foreground}}>{branded ? template.name : "Slide title"}<span/></span><span>{template.name} · v{template.version}</span></button>
}
