import {id} from "../../deck/src/index.ts"
import type {NativeText} from "../../deck/src/text/native-v3.ts"
import type {Paragraph} from "../../deck/src/text/body.ts"
import {isNativeSlide, type NativeElement} from "../../deck/src/text/native-v3.ts"
import {flatten} from "../../deck/src/elements.ts"
import {UsageLimitError,usageLimitSchema} from "./activity.ts"
import {createHash} from "node:crypto"
import {z} from "zod"
import {isSlide,type Element} from "../../deck/src/index.ts"
import type {AgentAdapter,AgentTools} from "./harness.ts"
const page=z.object({ok:z.literal(true),data:z.object({savedVersion:z.number().int(),items:z.array(z.unknown()),nextCursor:z.string().nullable().optional(),template:z.object({id:z.string(),version:z.number()}).nullable().optional()})})
function read(result:Awaited<ReturnType<AgentTools>>){const text=result.content.find(item=>item.type==="text");if(!text||text.type!=="text")throw new Error("tool-response-missing");return page.parse(JSON.parse(text.text)).data}
export const localAdapter:AgentAdapter=async function*(context,call,signal){
  const slideIds:string[]=[]
  let cursor:string|undefined,brandFont:string|undefined
  do{
    const result=await call("get_deck",{deckId:context.deckId,limit:50,...(cursor ? {cursor} : {})})
    yield {kind:"tool",name:"get_deck",result}
    const data=read(result)
    if(data.template&&!brandFont){
      const brand=await call("get_brand",{brandId:data.template.id,version:data.template.version})
      if(brand.isError)throw new Error("brand-read-refused")
      const content=brand.content.find(item=>item.type==="text")
      if(!content||content.type!=="text")throw new Error("brand-response-missing")
      brandFont=z.object({ok:z.literal(true),data:z.object({font:z.string()})}).parse(JSON.parse(content.text)).data.font
      yield {kind:"tool",name:"get_brand",result:brand}
    }
    slideIds.push(...z.array(z.object({id:z.string()})).parse(data.items).map(item=>item.id))
    cursor=data.nextCursor ?? undefined
  }while(cursor&&!signal.aborted)
  const selected=new Set(context.selection),found=new Set<string>()
  for(const id of slideIds){
    if(signal.aborted)return
    const result=await call("get_slide",{deckId:context.deckId,slideId:id})
    yield {kind:"tool",name:"get_slide",result}
    const slide=read(result).items[0]
    if(!isNativeSlide(slide) && !isSlide(slide))throw new Error("invalid-slide-response")
    if(selected.has(id))found.add(id)
    for(const element of flatten(slide.elements))if(selected.has(element.id))found.add(element.id)
  }
  if(selected.size&&found.size!==selected.size)throw new Error("selection-not-in-deck")
  for(const id of slideIds){
    if(signal.aborted)return
    if(context.completed?.includes(id))continue
    const result=await call("get_slide",{deckId:context.deckId,slideId:id})
    yield {kind:"tool",name:"get_slide",result,scope:id}
    const data=read(result),slide=data.items[0]
    if(!isNativeSlide(slide) && !isSlide(slide))throw new Error("invalid-slide-response")
    const attached=flatten(slide.elements).filter(element=>selected.has(element.id))
    if(selected.has(id))found.add(id)
    for(const element of attached)found.add(element.id)
    if(selected.size&&!selected.has(id)&&!attached.length)continue
    const update=(element:Element):Element=>{
      if(element.kind==="group")return {...element,children:element.children.map(update)}
      if(element.kind!=="text"||!brandFont)return element
      const [first,...rest]=element.runs
      return {...element,runs:[{...first,font:brandFont},...rest.map(run=>({...run,font:brandFont}))]}
    }
    const updateNative = (element: NativeElement): NativeElement => {
      if (element.kind === "group") return {...element, children: element.children.map(updateNative)}
      if (element.kind !== "text" || !brandFont) return element
      const font = brandFont, [first, ...rest] = element.body.paragraphs
      const paragraphFont = (paragraph: Paragraph): Paragraph => ({...paragraph, endStyle: {...paragraph.endStyle, font}, runs: paragraph.runs.map(run => ({...run, style: {...run.style, font}}))})
      return {...element, body: {...element.body, paragraphs: [paragraphFont(first), ...rest.map(paragraphFont)]}}
    }
    const changes = isNativeSlide(slide) ? selectedChanges(slide.elements.map(updateNative), slide, selected) : selectedChanges(slide.elements.map(update), slide, selected)
    const digest=createHash("sha256").update(JSON.stringify([context.run,id,context.request,context.selection])).digest("hex").slice(0,40)
    const write=await call("apply_changes",{deckId:context.deckId,base:data.savedVersion,requestId:`aira_${digest}`,changes})
    if(write.isError){
      for(const item of write.content)if(item.type==="text"){
        const refusal=z.object({error:z.object({details:usageLimitSchema})}).safeParse(JSON.parse(item.text))
        if(refusal.success)throw new UsageLimitError(refusal.data.error.details)
      }
      throw new Error("change-refused")
    }
    yield {kind:"tool",name:"apply_changes",result:write,scope:id,...(brandFont ? {brandApplied:true} : {})}
  }
  if(selected.size&&found.size!==selected.size)throw new Error("selection-not-in-deck")
  if(!slideIds.length){
    const result=await call("get_deck",{deckId:context.deckId}),data=read(result)
    const suffix=createHash("sha256").update(context.run).digest("hex").slice(0,12)
    const style={bold:true,font:brandFont??"Geist",size:40,color:"#111827"}
    const base={id:id(`title_${suffix}`),kind:"text",box:{x:64,y:64,width:832,height:160},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null} satisfies Omit<NativeText,"body">
    const element: NativeText | Element = context.textProtocol === "paragraph-body-v3" ? {...base,body:{frame:{id:id(`frame_${suffix}`),kind:"text-frame",anchor:"top",insets:{top:0,right:0,bottom:0,left:0},autofit:{kind:"none"}},paragraphs:[{id:id(`paragraph_${suffix}`),kind:"paragraph",runs:[{kind:"text",text:"New presentation",style}],endStyle:style,alignment:"left",level:0,indentation:{left:0,right:0,firstLine:0},marker:{kind:"none"},spacing:{before:0,after:0,line:{kind:"multiple",value:1.2}}}]}} : {...base,runs:[{text:"New presentation",...style}]}
    const write=await call("apply_changes",{deckId:context.deckId,base:data.savedVersion,requestId:`draft_${suffix}`,changes:[{kind:"insert",parent:context.deckId,index:0,value:{id:`slide_${suffix}`,version:0,size:{width:960,height:540},elements:[element],notes:"",theme:null,source:{kind:"created"}}}]})
    if(write.isError){
      for(const item of write.content)if(item.type==="text"){
        const refusal=z.object({error:z.object({details:usageLimitSchema})}).safeParse(JSON.parse(item.text))
        if(refusal.success)throw new UsageLimitError(refusal.data.error.details)
      }
      throw new Error("change-refused")
    }
    yield {kind:"tool",name:"apply_changes",result:write,scope:context.deckId}
  }
  yield {kind:"message",text:slideIds.length ? "Updated the attached content. Review changes by slide below." : "Created an editable title slide. Review it below."}
}

function selectedChanges<T extends Element | NativeElement, S extends {id: string}>(elements: T[], slide: S, selected: Set<string>) {
  const attached = flatten(elements).filter(element => selected.has(element.id))
  return attached.length ? attached.map(element => ({kind: "set", target: element.id, value: element} satisfies {kind: "set"; target: string; value: Element | NativeElement})) : [{kind: "set", target: slide.id, value: {...slide, elements}}]
}
