import {elementWithBox} from "./editor-model.ts"
import {useLayoutEffect,useRef,useState} from "react"
import {fontReport} from "../../../../packages/render/src/fonts.ts"
import {flatten,type Box,type Id,type Element} from "../../../../packages/deck/src/index.ts"
import type {PointerEvent} from "react"
import {Slide} from "../../../../packages/render/src/index.ts"

type ObjectEditing={selected:Id|null;select:(id:Id)=>void;geometry:(id:Id,box:Box)=>void}
export function SlidePreview({editing,onScale,...props}:Parameters<typeof Slide>[0]&{editing?:ObjectEditing;onScale?:(scale:number)=>void}) {
  const frame=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1)
  useLayoutEffect(()=>{const node=frame.current;if(!node)return;const measure=()=>{const width=node.getBoundingClientRect().width;if(width>0){const value=width/props.slide.size.width;setScale(value);onScale?.(value)}};measure();if(typeof ResizeObserver==="undefined")return;const observer=new ResizeObserver(measure);observer.observe(node);return ()=>observer.disconnect()},[props.slide.size.width,onScale])
  const [draft,setDraft]=useState<Box|null>(null)
  const dragCleanup=useRef<(()=>void)|null>(null)
  useLayoutEffect(()=>()=>dragCleanup.current?.(),[])
  const selected=flatten(props.slide.elements).find(element=>element.id===editing?.selected)
  function drag(event:PointerEvent<HTMLElement>,target:Id,kind:"move"|"resize") {
    if(!editing || event.button!==0)return
    const element=flatten(props.slide.elements).find(element=>element.id===target)
    if(!element || element.support.kind!=="native")return
    editing.select(target);event.stopPropagation()
    if(event.target instanceof HTMLElement && event.target.closest('[contenteditable="true"]'))return
    event.preventDefault();event.stopPropagation();frame.current?.focus();dragCleanup.current?.()
    const start={x:event.clientX,y:event.clientY},box=element.box
    const changed=(next:globalThis.PointerEvent):Box=>{
      const x=(next.clientX-start.x)/scale,y=(next.clientY-start.y)/scale
      return kind==="move" ? {...box,x:box.x+x,y:box.y+y} : {...box,width:Math.max(8,box.width+x),height:Math.max(8,box.height+y)}
    }
    const move=(next:globalThis.PointerEvent)=>setDraft(changed(next))
    const cleanup=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",cancel);setDraft(null);dragCleanup.current=null}
    const finish=(next:globalThis.PointerEvent)=>{cleanup();const value=changed(next);if(JSON.stringify(value)!==JSON.stringify(box))editing.geometry(target,value)}
    const cancel=()=>cleanup()
    dragCleanup.current=cleanup
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",finish,{once:true});window.addEventListener("pointercancel",cancel,{once:true})
  }
  function preview(elements:Element[]):Element[]{return elements.map(element=>draft&&element.id===selected?.id ? elementWithBox(element,draft) : element.kind==="group" ? {...element,children:preview(element.children)} : element)}
  function offset(elements:Element[],target:Id,x=0,y=0):{x:number;y:number}|null {for(const element of elements){if(element.id===target)return {x,y};if(element.kind==="group"){const found=offset(element.children,target,x+element.box.x,y+element.box.y);if(found)return found}}return null}
  const parent=selected ? offset(props.slide.elements,selected.id) : null,localBox=draft ?? selected?.box
  const visibleBox=localBox ? {...localBox,x:localBox.x+(parent?.x ?? 0),y:localBox.y+(parent?.y ?? 0)} : undefined
  const missing=fontReport(props.slide,props.themes).missing
  return <><div ref={frame} tabIndex={editing ? -1 : undefined} className="slide-preview" style={{aspectRatio:`${props.slide.size.width}/${props.slide.size.height}`}}><div className="slide-canvas" style={{inlineSize:props.slide.size.width,blockSize:props.slide.size.height,transform:`scale(${scale})`}}><Slide {...props} slide={draft ? {...props.slide,elements:preview(props.slide.elements)} : props.slide} {...(editing ? {onPointerDown:event=>{const element=flatten(props.slide.elements).find(element=>element.id===event.currentTarget.dataset.element);if(element)drag(event,element.id,"move")}} : {})}/>{selected&&visibleBox&&<div className="element-selection" style={{insetInlineStart:visibleBox.x,insetBlockStart:visibleBox.y,inlineSize:visibleBox.width,blockSize:visibleBox.height}}><button type="button" className="element-move" aria-label="Move selected object" onPointerDown={event=>drag(event,selected.id,"move")}/><button type="button" className="element-resize" aria-label="Resize selected object" onPointerDown={event=>drag(event,selected.id,"resize")}/></div>}</div></div>{missing.length>0 && <details className="slide-font-disclosure"><summary>Font substitution</summary><p>Missing fonts: {missing.join(", ")}. Using pinned Geist.</p></details>}</>
}
