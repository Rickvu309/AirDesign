import { id,parseDeck,flatten,type Deck,type Id,type Slide,type Element } from "../../../../packages/deck/src/index.ts"
export function nodeId() {return id(`n${crypto.randomUUID().replaceAll("-","").slice(0,30)}`)}
export function newSlide(deck?:Deck):Slide {
  return {id:nodeId(),version:0,size:deck?.slides[0]?.size ?? {width:960,height:540},elements:[{id:nodeId(),kind:"text",box:{x:64,y:64,width:832,height:100},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null,runs:[{text:"Add your title",bold:true,font:"Geist",size:40,color:"#172333"}]}],notes:"",theme:null,source:{kind:"created"}}
}
export function selectSlides(deck:Deck,selection:Id[],target:Id,anchor:Id|null,shift:boolean,toggle:boolean):Id[] {
  const ids=deck.slides.map(slide=>slide.id),start=ids.indexOf(anchor ?? target),end=ids.indexOf(target)
  if(shift && start>=0 && end>=0)return ids.slice(Math.min(start,end),Math.max(start,end)+1)
  const chosen=toggle ? selection.includes(target) ? selection.filter(value=>value!==target) : [...selection,target] : [target]
  return ids.filter(value=>chosen.includes(value))
}
export function orderedSlides(deck:Deck,selection:Id[],direction:-1|1):Id[] {
  const order=deck.slides.map(slide=>slide.id),selected=new Set(selection)
  if(direction===-1)for(let i=1;i<order.length;i++) {const current=order[i],previous=order[i-1];if(current && previous && selected.has(current) && !selected.has(previous))[order[i-1],order[i]]=[current,previous]}
  else for(let i=order.length-2;i>=0;i--) {const current=order[i],next=order[i+1];if(current && next && selected.has(current) && !selected.has(next))[order[i],order[i+1]]=[next,current]}
  return order
}
function copiedElement(element:Element):Element {const base={...element,id:nodeId()};return base.kind==="group" ? {...base,children:base.children.map(copiedElement)} : base}
export type PasteReview={source:string;accepted:Slide[];refused:string[]}
export function reviewPaste(source:string):PasteReview {
  const accepted:Slide[]=[],refused:string[]=[]
  try {
    const raw:unknown=JSON.parse(source)
    if(!raw || typeof raw!=="object" || !("slides" in raw) || !Array.isArray(raw.slides))throw new Error("Paste slide JSON with a slides array.")
    raw.slides.forEach((candidate:unknown,index:number)=>{
      try {const deck=parseDeck({id:"paste",version:0,slides:[candidate],themes:"themes" in raw ? raw.themes : []}),slide=deck.slides[0];if(!slide)throw new Error("Missing slide");if(slide.source.kind!=="created" || slide.theme || flatten(slide.elements).some(element=>element.theme || element.placeholder || element.overlap || element.source.kind!=="created" || element.support.kind!=="native"))throw new Error("Paste requires native slides without external theme or source references.");accepted.push({...slide,id:nodeId(),elements:slide.elements.map(copiedElement)})}
      catch(error){refused.push(`Slide ${index+1}: ${error instanceof Error ? error.message : "Unsupported slide"}`)}
    })
  }catch(error){refused.push(error instanceof Error ? error.message : "Invalid slide data")}
  return {source,accepted,refused}
}
