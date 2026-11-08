import {decodeCatalogImportV3, decodeLegacyCatalogDeckV2} from "../../../../packages/catalog/src/text/seed.ts"
import type {ParagraphHistoryStore} from "../db/paragraph-history-store.ts"
import {createHash} from "node:crypto"
import {toolInput} from "../../../../packages/tools/src/catalog.ts"
import {boundedResult,textResult} from "../../../../packages/tools/src/snapshots.ts"
import {nodes,type Principal,commandId} from "../../../../packages/change-log/src/index.ts"
import {parseCommand} from "../../../../packages/rpc/src/parse-command.ts"
import {apply,id,themeId,validate,parseDeck,type Deck,type Element} from "../../../../packages/deck/src/index.ts"
import {applyTemplate,type Template} from "../../../../packages/brand/src/index.ts"
import {assetProviders} from "../../../../packages/files/src/assets/providers.ts"
import {fetchPublicFile} from "../../../../packages/files/src/fetch-public-file.ts"
import {fileLimits} from "../../../../packages/files/src/index.ts"
import {operationId,type OperationStore} from "../../../../packages/operations/src/index.ts"
import type {TemplateStore} from "../../../../packages/brand/src/template-store.ts"
import type {HistoryStore} from "../db/history-store.ts"
import {slideCaptures} from "./capture.ts"
export type ToolPrincipal=Principal&{connection:string;airaRun?:string}
const string=(args:Record<string,unknown>,key:string,fallback="")=>typeof args[key]==="string" ? args[key] : fallback
const number=(args:Record<string,unknown>,key:string,fallback=0)=>typeof args[key]==="number" ? args[key] : fallback
function brandedDeck(template:Template):Deck{
  const deck={id:id("newDeck"),version:0,slides:[],themes:[{id:themeId("default"),font:"Geist",background:"#ffffff"}]}
  const result=apply(deck,applyTemplate(deck,template,{kind:"apply-deck"},undefined).changes)
  if(!result.ok)throw new Error(result.error.code)
  return result.deck
}
export function domainTools(history:HistoryStore,templates:TemplateStore,operations:OperationStore,imageQueue:OperationStore,origin:string,changed:(deck:string)=>Promise<void>,paragraphs?:ParagraphHistoryStore){
  const captures=slideCaptures(history)
  async function saved(principal:Principal,args:Record<string,unknown>){const result=await history.read(principal,string(args,"deckId"));if("savedVersion" in args && result.seq!==args.savedVersion)throw new Error("saved-version-changed");return result}
  async function operation(principal:Principal,value:string){
    const native=paragraphs && (await paragraphs.protocol()).protocol==="paragraph-body-v3" ? paragraphs : undefined
    try{const result=await (native?.exports ?? history.exports).status(principal,value);return {...result,operationId:result.id,...(result.kind==="ready" ? {resource:`airdesign://exports/${result.id}`} : {})}}
    catch(error){if(!(error instanceof Error)||error.message!=="export-not-found")throw error}
    let result,source:"imports"|"images"="imports"
    try{result=operations.status(principal,operationId(value))}catch(error){if(!(error instanceof Error)||error.message!=="operation-not-found")throw error;source="images";result=imageQueue.status(principal,operationId(value))}
    const entry=result.kind==="ready"&&source==="imports" ? (native ? await native.catalog.create(principal,`mcp_import_${value}`,"Imported deck","",decodeCatalogImportV3(result.report),{bytes:operations.artifact(principal,result.id),report:result.report}) : await history.catalog.create(principal,`mcp_import_${value}`,"Imported deck","",parseDeck(result.report.deck),{bytes:operations.artifact(principal,result.id),report:result.report})) : null
    return {operationId:result.id,kind:result.kind,attempts:result.attempts,...(entry ? {deck:entry} : {}),...(result.kind==="failed" ? {reason:result.reason} : {}),...(result.kind==="ready" ? {resource:`airdesign://${source}/${result.id}`,sha256:result.sha256,expires:result.expires} : {})}
  }
  return {
    close:()=>captures.close(),
    async call(principal:ToolPrincipal,name:string,input:unknown){
      const admission=await paragraphs?.protocol()
      if(admission?.kind==="paused")return textResult({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"},true)
      const native=admission?.protocol==="paragraph-body-v3" ? paragraphs : undefined
      if(native && !["get_context","list_decks","create_deck","import_deck","get_operation","add_file"].includes(name))return textResult({kind:"refused",code:"editing-feature-pending",retryable:false,next:"retain-and-reconcile"},true)
      const args=toolInput(name,input),owner=principal.personId
      const page=(load:()=>Promise<{items:unknown[];meta:Record<string,unknown>}>)=>(native?.snapshots ?? history.snapshots).page(owner,name,args,load)
      switch(name){
        case "get_context":return boundedResult({activeDeck:null,selection:[],brands:templates.list(principal).map(({id,version,name})=>({id,version,name})),usage:await history.usage.status(owner),help:"Use list_decks to choose a deck. Remote clients have no Studio selection."})
        case "list_decks":return page(async()=>({items:await (native?.catalog ?? history.catalog).list(principal,false,string(args,"query")),meta:{}}))
        case "get_deck":return page(async()=>{const current=await saved(principal,args);return {meta:{deckId:current.deck.id,savedVersion:current.seq,template:current.deck.template ?? null},items:current.deck.slides.map(slide=>({id:slide.id,version:slide.version,size:slide.size,elements:slide.elements.length,notes:slide.notes.slice(0,160)}))}})
        case "get_slide":return page(async()=>{const current=await saved(principal,args),slide=current.deck.slides.find(item=>item.id===args.slideId);if(!slide)throw new Error("slide-not-found");const root=string(args,"rootId");const find=(elements:Element[]):Element|undefined=>{for(const element of elements){if(element.id===root)return element;if(element.kind==="group"){const found=find(element.children);if(found)return found}}return undefined};const target=root ? find(slide.elements) : null;if(root&&!target)throw new Error("node-not-found");if(args.format==="jsx"){
          const {toJsx}=await import("../../../../packages/deck/src/jsx.ts")
          const {jsxNode}=await import("./slide-jsx.ts")
          const items=root ? [target] : slide.elements
          return {meta:{deckId:current.deck.id,slideId:slide.id,savedVersion:current.seq,format:"jsx"},items:items.filter(item=>item!==null&&item!==undefined).map(item=>({id:item.id,jsx:toJsx({...current.deck,slides:[{...slide,elements:[item]}]},{toJsx:deck=>jsxNode(deck.slides[0]!.elements[0]!),fromJsx:value=>value})}))}
        }
        return {meta:{deckId:current.deck.id,slideId:slide.id,savedVersion:current.seq},items:root ? [target] : [slide]}})
        case "find_elements":return page(async()=>{const current=await saved(principal,args),query=string(args,"query").toLowerCase(),kind=string(args,"kind");return {meta:{savedVersion:current.seq},items:nodes(current.deck).filter(node=>(!kind||node.fields.kind===kind)&&typeof node.fields.kind==="string"&&JSON.stringify(node.fields).toLowerCase().includes(query)).map(node=>({id:node.id,parent:node.parent,kind:node.fields.kind,box:node.fields.box,...(node.fields.kind==="text" ? {text:JSON.stringify(node.fields.runs).slice(0,200)} : {})}))}})
        case "get_brand":{const found=templates.list(principal).filter(item=>item.id===args.brandId&&(!("version" in args)||item.version===args.version)).sort((a,b)=>b.version-a.version)[0];if(!found)throw new Error("brand-not-found");return boundedResult(found)}
        case "search_assets":return page(async()=>{const source=string(args,"source","local-stock"),query=string(args,"query");if(source==="library")return {meta:{source},items:(await history.images.list(principal)).assets.filter(item=>JSON.stringify(item).toLowerCase().includes(query.toLowerCase()))};const provider=assetProviders.find(item=>item.id===source);if(!provider)throw new Error("provider-not-found");return {meta:{source},items:provider.search(query).map(item=>({id:item.id,name:item.name,keywords:item.keywords,provenance:item.provenance,ingest:{provider:source,id:item.id}}))}})
        case "read_file":{const file=await history.files.read(owner,string(args,"fileId")),offset=number(args,"offset"),length=Math.min(number(args,"length",2000),2000),text=file.mime.startsWith("text/")||file.mime==="application/json";return boundedResult({fileId:file.fileId,name:file.name,mime:file.mime,bytes:file.bytes,sha256:file.sha256,...(text ? {text:file.content.toString("utf8").slice(offset,offset+length),nextOffset:offset+length<file.content.toString("utf8").length ? offset+length : null} : {resource:file.resource})})}
        case "add_file":{const source=string(args,"sourceUrl"),url=new URL(source);const local=url.origin===origin&&/^\/api\/mcp\/files\/[a-f0-9-]{36}$/.test(url.pathname)&&!url.search&&!url.hash;return boundedResult(await history.files.save(owner,string(args,"requestId"),JSON.stringify({source,name:args.name}),string(args,"name"),async()=>{if(local){const file=await history.files.read(owner,url.pathname.split("/").at(-1) ?? "");return {bytes:file.content,mime:file.mime}}return fetchPublicFile(source,fileLimits.compressed)}))}
        case "create_deck":{const template=args.brandId ? templates.list(principal).filter(item=>item.id===args.brandId).sort((a,b)=>b.version-a.version)[0] : templates.default(principal);if(!template)throw new Error("brand-not-found");return boundedResult(native ? await native.catalog.create(principal,string(args,"requestId"),string(args,"title"),"",decodeLegacyCatalogDeckV2(brandedDeck(template))) : await history.catalog.create(principal,string(args,"requestId"),string(args,"title"),"",brandedDeck(template)))}
        case "update_brand":{const tokens=args.tokens;if(!tokens||typeof tokens!=="object")throw new Error("invalid-tokens");const checked:Partial<Pick<Template,"font"|"background"|"foreground"|"accent">>={};for(const key of ["font","background","foreground","accent"] as const){const value=Reflect.get(tokens,key);if(typeof value==="string")checked[key]=value}return boundedResult(templates.update(principal,string(args,"requestId"),string(args,"brandId"),number(args,"base"),checked))}
        case "export_deck":{const format=string(args,"format");if(format!=="pptx"&&format!=="pdf")throw new Error("invalid-format");const job=await history.exports.submit(principal,string(args,"requestId"),string(args,"deckId"),{format,expectedSeq:number(args,"savedVersion"),slides:[],timing:"now",allowIssues:false});return boundedResult({operationId:job.id,kind:job.kind,pollAfterMs:1000})}
        case "import_deck":{const file=await history.files.read(owner,string(args,"fileId"));if(file.content.length<4||file.content.readUInt32LE(0)!==0x04034b50)throw new Error("pptx-upload-required");const job=operations.submit(principal,string(args,"requestId"),file.content);return boundedResult({operationId:job.id,kind:job.kind,pollAfterMs:1000})}
        case "get_operation":return boundedResult(await operation(principal,string(args,"operationId")))
        case "capture_slide":{const current=await saved(principal,args);const {full,preview}=await captures.capture(principal,current.deck,string(args,"slideId"),number(args,"width",1280));const resource=await history.snapshots.binary(owner,full);return {content:[{type:"image" as const,mimeType:"image/png",data:preview.toString("base64")},...textResult({deckId:current.deck.id,slideId:args.slideId,savedVersion:current.seq,sha256:createHash("sha256").update(full).digest("hex"),...resource}).content]}}
        case "check_deck":return page(async()=>{const current=await saved(principal,args);validate(current.deck);const checks=Array.isArray(args.checks) ? args.checks : ["structure","support"];return {meta:{savedVersion:current.seq,valid:true,checks},items:(checks.includes("support") ? nodes(current.deck) : []).filter(node=>{const support=node.fields.support;return support&&typeof support==="object"&&!Array.isArray(support)&&support.kind!=="native"}).map(node=>({id:node.id,support:node.fields.support}))}})
        case "apply_changes":case "undo_change":{
          const deck=string(args,"deckId"),base=number(args,"base"),prefix=`mcp_${principal.connection.replaceAll("-","")}_`
          const run=principal.airaRun ?? prefix+createHash("sha256").update(string(args,"requestId")).digest("hex")
          let undoOf:string|undefined
          if(name==="undo_change"){
            const target=(await history.read(principal,deck)).contributions.history.events.find(event=>event.id===args.changeId)
            if(!target?.run?.startsWith(prefix))return textResult({kind:"refused",code:"invalid-undo-target"},true)
            undoOf=target.run
          }
          const request=commandId(`m_${createHash("sha256").update(principal.connection+":"+string(args,"requestId")).digest("hex")}`)
          const command=name==="apply_changes" ? parseCommand({id:request,kind:"edit",base,run,changes:{changes:args.changes}}) : parseCommand({id:request,kind:"undo-change",base,run,target:string(args,"changeId")})
          const receipt=await history.commit(principal,deck,command,{kind:"run",run,actor:principal.airaRun ? "aira" : "user-agent",...(undoOf ? {undoOf} : {})},undefined,base)
          if(receipt.kind==="applied"){await changed(deck);return boundedResult({...receipt,changeId:request,savedVersion:receipt.seq})}
          if(receipt.code==="out-of-usage")return textResult({kind:"out-of-usage",requestKept:true,requestId:args.requestId,usage:await history.usage.status(owner),message:"Your weekly usage is used up. Reset it in AirDesign or wait until the next reset. You can keep editing manually."},true)
          return textResult({kind:"refused",code:receipt.code,savedVersion:receipt.seq},true)
        }
        default:throw new Error("unknown-tool")
      }
    },
    async resource(principal:ToolPrincipal,uri:string){
      const url=new URL(uri);if(url.protocol!=="airdesign:")throw new Error("resource-not-found")
      const value=url.pathname.slice(1),offset=Number(url.searchParams.get("offset") ?? 0);if(!Number.isSafeInteger(offset)||offset<0)throw new Error("invalid-offset")
      const native=paragraphs && (await paragraphs.protocol()).protocol==="paragraph-body-v3" ? paragraphs : undefined
      let bytes:Buffer,mime:string
      if(url.hostname==="captures"){const data=await (native?.snapshots ?? history.snapshots).resource(principal.personId,value);if(!data||typeof data!=="object"||!("base64" in data)||typeof data.base64!=="string")throw new Error("resource-not-found");bytes=Buffer.from(data.base64,"base64");mime="image/png"}
      else if(url.hostname==="files"){const file=await history.files.read(principal.personId,value);bytes=file.content;mime=file.mime}
      else if(url.hostname==="exports"){const file=await (native?.exports ?? history.exports).artifact(principal,value);bytes=file.bytes;mime=file.format==="pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation"}
      else if(url.hostname==="imports"){bytes=operations.artifact(principal,operationId(value));mime="application/vnd.openxmlformats-officedocument.presentationml.presentation"}
      else if(url.hostname==="images"){bytes=imageQueue.artifact(principal,operationId(value));mime="application/octet-stream"}
      else if(url.hostname==="snapshots"){const data=await (native?.snapshots ?? history.snapshots).resource(principal.personId,value);const index=Number(url.searchParams.get("index") ?? 0);if(!Number.isSafeInteger(index)||index<0||!data||typeof data!=="object"||!("items" in data)||!Array.isArray(data.items)||index>=data.items.length)throw new Error("resource-not-found");bytes=Buffer.from(JSON.stringify(data.items[index]));mime="application/json"}
      else throw new Error("resource-not-found")
      if(offset>bytes.length)throw new Error("invalid-offset")
      const end=Math.min(offset+9000,bytes.length),next=new URL(uri);next.searchParams.set("offset",String(end))
      return {contents:[{uri,mimeType:mime,blob:bytes.subarray(offset,end).toString("base64")},{uri:uri+"#page",mimeType:"application/json",text:JSON.stringify({bytes:bytes.length,offset,end,nextUri:end<bytes.length ? next.href : null})}]}
    },
  }
}
