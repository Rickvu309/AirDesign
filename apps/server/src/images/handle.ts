import {paragraphFeatureAdmission} from "../rpc/paragraph-boundary.ts"
import type {ParagraphHistoryStore} from "../db/paragraph-history-store.ts"
import {activeHistory} from "../db/active-history.ts"
import { imageJob } from "../../../../packages/files/src/assets/image-job.ts"
import { mutationRejection,type Access } from "@airdesign/access"
import { OperationStore,operationId } from "../../../../packages/operations/src/index.ts"
import { commandId } from "../../../../packages/change-log/src/index.ts"
import { flatten,id,isImagePlacement } from "../../../../packages/deck/src/index.ts"
import { assetLimits,readValidatedAsset,validateImage } from "../../../../packages/files/src/assets/validate.ts"
import { uploadProvenance } from "../../../../packages/files/src/assets/provenance.ts"
import { assetProviders } from "../../../../packages/files/src/assets/providers.ts"
import type { HistoryStore } from "../db/history-store.ts"

function record(value:unknown):Record<string,unknown>{if(!value || typeof value!=="object" || Array.isArray(value))throw new Error("invalid-image-request");return Object.fromEntries(Object.entries(value))}
function text(value:unknown):string{if(typeof value!=="string")throw new Error("invalid-image-request");return value}
export function imagesHandler(access:Access,queue:OperationStore,history:HistoryStore,origin:string,changed:(deck:string)=>Promise<void>,paragraphs?:ParagraphHistoryStore) {
  return async(request:Request):Promise<Response>=>{
    const rejection=mutationRejection(request,origin);if(rejection)return Response.json(rejection,{status:rejection.status})
    const principal=await access.principal(request);if(!principal)return Response.json({code:"signed-out"},{status:401})
    const url=new URL(request.url)
    try {
      const backend=await activeHistory(history,paragraphs),store=backend.images
      if(url.pathname==="/api/assets" && request.method==="GET")return Response.json(await store.list(principal))
      if(url.pathname==="/api/assets/search" && request.method==="GET"){
        const provider=assetProviders.find(provider=>provider.id===(url.searchParams.get("provider") ?? "local-stock"));if(!provider)throw new Error("provider-not-found")
        const query=url.searchParams.get("q") ?? "";if(query.length>200)throw new Error("query-too-long")
        return Response.json({query,provider:provider.id,items:provider.search(query).map(({id,name,provenance})=>({id,name,provenance}))})
      }
      const preview=/^\/api\/assets\/providers\/([^/]+)\/([^/]+)\/thumbnail$/.exec(url.pathname)
      if(preview&&request.method==="GET"){
        const provider=assetProviders.find(provider=>provider.id===preview[1]);if(!provider)throw new Error("provider-not-found")
        const item=await provider.read(preview[2]!),image=await validateImage(item.bytes)
        return new Response(new Uint8Array(Buffer.from(image.thumbnail,"base64")),{headers:{"content-type":"image/png","cache-control":"private, max-age=3600"}})
      }
      if((url.pathname==="/api/assets/ingest" || url.pathname==="/api/assets/provider") && request.method==="POST"){
        const body=record(await request.json()),requestId=text(body.requestId)
        let bytes:Buffer,provenance=uploadProvenance
        if(url.pathname.endsWith("/provider")){
          if(Object.keys(body).some(key=>!["provider","item","requestId"].includes(key)))throw new Error("invalid-image-request")
          const provider=assetProviders.find(provider=>provider.id===body.provider);if(!provider)throw new Error("provider-not-found")
          const item=await provider.read(text(body.item));bytes=item.bytes;provenance=item.provenance
        }else{
          if(Object.keys(body).some(key=>!["base64","requestId"].includes(key)))throw new Error("local-image-upload-required")
          const base64=text(body.base64)
          if(base64.length>Math.ceil(assetLimits.bytes/3)*4 || base64.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error("image-size-limit-or-invalid-base64")
          bytes=Buffer.from(base64,"base64")
          if(!bytes.length || bytes.length>assetLimits.bytes)throw new Error("image-size-limit")
        }
        return Response.json(queue.submit(principal,requestId,imageJob(bytes,provenance)),{status:202})
      }
      const job=/^\/api\/assets\/jobs\/([a-f0-9-]{36})(?:\/(adopt|cancel))?$/.exec(url.pathname)
      if(job?.[1]){
        const key=operationId(job[1])
        if(job[2]==="adopt" && request.method==="POST"){
          const {image,provenance}=readValidatedAsset(queue.artifact(principal,key))
          return Response.json(await store.adopt(principal,image,provenance))
        }
        if(job[2]==="cancel" && request.method==="POST")return Response.json(queue.cancel(principal,key))
        if(!job[2] && request.method==="GET")return Response.json(queue.status(principal,key))
      }
      const media=/^\/api\/assets\/([a-f0-9]{64})(?:\/(media|thumbnail|original))?$/.exec(url.pathname)
      if(media?.[1]){
        if(request.method==="DELETE" && !media[2])return Response.json(await store.remove(principal,media[1]))
        if(request.method==="GET"){
          if(!media[2])return Response.json(await store.get(principal,media[1]))
          const result=await store.media(principal,media[1],media[2]==="media" ? "normalized" : media[2]==="original" ? "original" : "thumbnail")
          return new Response(new Uint8Array(result.bytes),{headers:{"content-type":result.mime,"x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox","content-disposition":media[2]==="original" ? "attachment" : "inline"}})
        }
      }
      if((url.pathname==="/api/assets/place" || url.pathname==="/api/assets/update") && request.method==="POST"){
        const body=record(await request.json()),deckId=text(body.deck),requestId=text(body.requestId),update=url.pathname.endsWith("/update")
        const asset=await store.get(principal,text(body.asset)),image={asset:asset.id,crop:body.crop ?? {x:0,y:0,width:1,height:1},focal:body.focal ?? {x:.5,y:.5},mask:body.mask ?? "rectangle",alt:body.alt ?? ""}
        if(!isImagePlacement(image))throw new Error("invalid-image-placement")
        const elementId=id(text(body.elementId)),slideId=update ? null : id(text(body.slide))
        const receipt=await backend.commit(principal,deckId,{id:commandId(requestId),kind:"edit",base:0,run:null,changes:{changes:[]}},{kind:"person"},undefined,{key:JSON.stringify({image,elementId,slideId,update}),changes:deck=>{
          if(update){const element=deck.slides.flatMap(slide=>flatten(slide.elements)).find(element=>element.id===elementId);if(element?.kind!=="image")throw new Error("image-placement-not-found");return {changes:[{kind:"set",target:element.id,value:{...element,image}}]}}
          const slide=deck.slides.find(slide=>slide.id===slideId);if(!slide)throw new Error("slide-not-found")
          const width=Math.min(slide.size.width*.6,asset.width),height=width*asset.height/asset.width,scale=Math.min(1,slide.size.height*.7/height)
          const element:import("../../../../packages/deck/src/text/native-v3.ts").NativeElement={id:elementId,kind:"image",image,box:{x:40,y:40,width:width*scale,height:height*scale},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null}
          return {changes:[{kind:"insert",parent:slide.id,index:slide.elements.length,value:element}]}
        }})
        await changed(deckId)
        return Response.json({receipt},{status:receipt.kind==="applied" ? 200 : 409})
      }
      return Response.json({code:"not-found"},{status:404})
    }catch(error){const admission=await paragraphFeatureAdmission(paragraphs,request);if(admission)return admission;const code=error instanceof Error ? error.message : "image-request-failed";return Response.json({code},{status:code.endsWith("not-found") ? 404 : code==="image-storage-full" ? 413 : 400})}
  }
}
