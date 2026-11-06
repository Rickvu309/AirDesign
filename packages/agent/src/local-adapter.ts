import {UsageLimitError,usageLimitSchema} from "./activity.ts"
import {createHash} from "node:crypto"
import {z} from "zod"
import {isSlide,flatten,type Element,type Slide} from "../../deck/src/index.ts"
import type {AgentAdapter,AgentTools} from "./harness.ts"
const page=z.object({ok:z.literal(true),data:z.object({savedVersion:z.number().int(),items:z.array(z.unknown()),nextCursor:z.string().nullable().optional()})})
function read(result:Awaited<ReturnType<AgentTools>>){const text=result.content.find(item=>item.type==="text");if(!text||text.type!=="text")throw new Error("tool-response-missing");return page.parse(JSON.parse(text.text)).data}
export const localAdapter:AgentAdapter=async function*(context,call,signal){
  const slideIds:string[]=[]
  let cursor:string|undefined
  do{
    const result=await call("get_deck",{deckId:context.deckId,limit:50,...(cursor ? {cursor} : {})})
    yield {kind:"tool",name:"get_deck",result}
    const data=read(result)
    slideIds.push(...z.array(z.object({id:z.string()})).parse(data.items).map(item=>item.id))
    cursor=data.nextCursor ?? undefined
  }while(cursor&&!signal.aborted)
  const selected=new Set(context.selection),found=new Set<string>()
  for(const id of slideIds){
    if(signal.aborted)return
    const result=await call("get_slide",{deckId:context.deckId,slideId:id})
    yield {kind:"tool",name:"get_slide",result}
    const slide=read(result).items[0]
    if(!isSlide(slide))throw new Error("invalid-slide-response")
    if(selected.has(id))found.add(id)
    for(const element of flatten(slide.elements))if(selected.has(element.id))found.add(element.id)
  }
  if(selected.size&&found.size!==selected.size)throw new Error("selection-not-in-deck")
  for(const id of slideIds){
    if(signal.aborted)return
    if(context.completed?.includes(id))continue
    const result=await call("get_slide",{deckId:context.deckId,slideId:id})
    yield {kind:"tool",name:"get_slide",result}
    const data=read(result),slide=data.items[0]
    if(!isSlide(slide))throw new Error("invalid-slide-response")
    const attached=flatten(slide.elements).filter(element=>selected.has(element.id))
    if(selected.has(id))found.add(id)
    for(const element of attached)found.add(element.id)
    if(selected.size&&!selected.has(id)&&!attached.length)continue
    const value:Slide={...slide,notes:context.request}
    const changes=attached.length ? attached.map(element=>{
      const updated:Element=element.kind==="text" ? {...element,runs:[{...element.runs[0],text:context.request}]} : element
      return {kind:"set" as const,target:element.id,value:updated}
    }) : [{kind:"set" as const,target:slide.id,value}]
    const digest=createHash("sha256").update(JSON.stringify([context.run,id,context.request,context.selection])).digest("hex").slice(0,40)
    const write=await call("apply_changes",{deckId:context.deckId,base:data.savedVersion,requestId:`aira_${digest}`,changes})
    if(write.isError){
      for(const item of write.content)if(item.type==="text"){
        const refusal=z.object({error:z.object({details:usageLimitSchema})}).safeParse(JSON.parse(item.text))
        if(refusal.success)throw new UsageLimitError(refusal.data.error.details)
      }
      throw new Error("change-refused")
    }
    yield {kind:"tool",name:"apply_changes",result:write,scope:id}
  }
  if(selected.size&&found.size!==selected.size)throw new Error("selection-not-in-deck")
  if(!slideIds.length){
    const result=await call("get_deck",{deckId:context.deckId}),data=read(result)
    const suffix=createHash("sha256").update(context.run).digest("hex").slice(0,12)
    const write=await call("apply_changes",{deckId:context.deckId,base:data.savedVersion,requestId:`draft_${suffix}`,changes:[{kind:"insert",parent:context.deckId,index:0,value:{id:`slide_${suffix}`,version:0,size:{width:960,height:540},elements:[{id:`title_${suffix}`,kind:"text",box:{x:64,y:64,width:832,height:160},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null,runs:[{text:context.request.slice(0,120),bold:true,font:"Geist",size:40,color:"#111827"}]}],notes:"",theme:null,source:{kind:"created"}}}]})
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
