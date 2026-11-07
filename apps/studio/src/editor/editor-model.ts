import { id,parseDeck,flatten,type Deck,type Id,type Slide,type Element } from "../../../../packages/deck/src/index.ts"
export function nodeId() {return id(`n${crypto.randomUUID().replaceAll("-","").slice(0,30)}`)}
export type SlideLayout="title"|"summary"|"chart"|"columns"|"table"|"next"
export function fitToolElement(element:Element,size:Slide["size"]):Element {
  const horizontal=size.width/960,vertical=size.height/540
  const fitted={...element,box:{x:element.box.x*horizontal,y:element.box.y*vertical,width:element.box.width*horizontal,height:element.box.height*vertical}}
  if(fitted.kind==="group")return {...fitted,children:fitted.children.map(child=>fitToolElement(child,size))}
  if(fitted.kind==="text") {
    const scale=(run:typeof fitted.runs[number])=>({...run,size:run.size*Math.min(horizontal,vertical)})
    const [first,...rest]=fitted.runs
    return {...fitted,runs:[scale(first),...rest.map(scale)]}
  }
  return fitted
}
export function newSlide(deck?:Deck,layout:SlideLayout="title"):Slide {
  const theme=deck?.themes.find(theme=>theme.id===deck.template?.id),link=theme?.id ?? null
  const ink=theme?.foreground ?? "#172333",font=theme?.font ?? "Geist"
  const base=()=>({id:nodeId(),source:{kind:"created"},support:{kind:"native"},theme:link,placeholder:null,overlap:null} as const)
  const text=(value:string,x:number,y:number,width:number,size=22,bold=false):Element=>({...base(),kind:"text",box:{x,y,width,height:size*3},runs:[{text:value,bold,font,size,color:ink}]})
  const elements:Element[]=[text(layout==="next" ? "Next steps" : layout==="summary" ? "Executive summary" : "Add your title",64,64,832,40,true)]
  if(layout==="summary" || layout==="next")elements.push(text("1. Add your first point\n2. Add your next point\n3. Add your final point",64,180,832))
  if(layout==="columns")elements.push(text("First idea\nAdd supporting detail",64,180,384),text("Second idea\nAdd supporting detail",512,180,384))
  if(layout==="chart") {
    for(const [index,height] of [100,160,210,260].entries())elements.push({...base(),kind:"shape",geometry:"rectangle",fill:ink,box:{x:96+index*130,y:440-height,width:90,height}})
    elements.push(text("Add your takeaway",670,180,226))
  }
  if(layout==="table")for(let row=0;row<4;row++)for(let column=0;column<3;column++)elements.push(text(row===0 ? "Header" : "Value",64+column*280,180+row*64,260,20,row===0))
  const size=deck?.slides[0]?.size ?? {width:960,height:540}
  return {...(deck?.template?.layout ? {layout:{template:deck.template.id,version:deck.template.version,family:deck.template.family,...deck.template.layout}} : {}),id:nodeId(),version:0,size,elements:elements.map(element=>fitToolElement(element,size)),notes:"",theme:link,source:{kind:"created"}}
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

export function clipboardSource(deck:Deck,selection:Id[]) {
  const detached=(element:Element):Element=>{
    const base={...element,theme:null}
    return base.kind==="group" ? {...base,children:base.children.map(detached)} : base
  }
  return JSON.stringify({slides:deck.slides.filter(slide=>selection.includes(slide.id)).map(slide=>({...slide,theme:null,elements:slide.elements.map(detached)}))})
}
