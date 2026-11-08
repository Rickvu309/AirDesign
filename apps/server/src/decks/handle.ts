import {paragraphFeatureAdmission} from "../rpc/paragraph-boundary.ts"
import {decodeCatalogImportV3, decodeLegacyCatalogDeckV2} from "../../../../packages/catalog/src/text/seed.ts"
import type {ParagraphHistoryStore} from "../db/paragraph-history-store.ts"
import {welcomeDeck} from "../../../../packages/catalog/src/welcome-deck.ts"
import { applyTemplate } from "../../../../packages/brand/src/index.ts"
import type { TemplateStore } from "../../../../packages/brand/src/template-store.ts"
import { apply, id, themeId } from "../../../../packages/deck/src/index.ts"
import { parseDeck } from "../../../../packages/deck/src/index.ts"
import { OperationStore,operationId } from "../../../../packages/operations/src/index.ts"
import { exportFilename } from "./export-filename.ts"
import { parseExportOptions } from "./parse-export.ts"
import { mutationRejection, type Access } from "@airdesign/access"
import type { HistoryStore } from "../db/history-store.ts"

function text(body:unknown,key:string):string {if(!body || typeof body!=="object" || !(key in body))throw new Error(`missing-${key}`);const value=Reflect.get(body,key);if(typeof value!=="string")throw new Error(`invalid-${key}`);return value}
export function decksHandler(access:Access,history:HistoryStore,origin:string,changed:(deck:string)=>Promise<void>,operations:OperationStore,templates?:TemplateStore,paragraphs?:ParagraphHistoryStore) {
  return async(request:Request):Promise<Response>=>{
    const rejection=mutationRejection(request,origin);if(rejection)return Response.json(rejection,{status:rejection.status})
    const principal=await access.principal(request);if(!principal)return Response.json({code:"signed-out"},{status:401})
    const url=new URL(request.url)
    try {
      const native=paragraphs && (await paragraphs.protocol()).protocol==="paragraph-body-v3" ? paragraphs : undefined
      const catalog=native?.catalog ?? history.catalog
      const exports=native?.exports ?? history.exports
      const exportMatch=/^\/api\/catalog\/export-jobs\/([a-f0-9-]{36})(?:\/(artifact|cancel|retry))?$/.exec(url.pathname)
      if(exportMatch?.[1]) {
        const id=exportMatch[1]
        if(exportMatch[2]==="artifact" && request.method==="GET"){const result=await exports.artifact(principal,id);return new Response(new Uint8Array(result.bytes),{headers:{"content-type":result.format==="pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation","content-disposition":`attachment; filename="${exportFilename(result.title,result.seq,result.format)}"`}})}
        if(exportMatch[2]==="cancel" && request.method==="POST")return Response.json(await exports.cancel(principal,id))
        if(exportMatch[2]==="retry" && request.method==="POST")return Response.json(await exports.retry(principal,id))
        if(!exportMatch[2] && request.method==="GET")return Response.json(await exports.status(principal,id))
        return Response.json({code:"method-not-allowed"},{status:405})
      }
      const submit=/^\/api\/catalog\/([a-zA-Z][a-zA-Z0-9_-]{0,31})\/exports$/.exec(url.pathname)
      if(submit?.[1] && request.method==="GET")return Response.json(await exports.list(principal,submit[1]))
      if(submit?.[1] && request.method==="POST"){const body:unknown=await request.json();return Response.json(await exports.submit(principal,text(body,"requestId"),submit[1],parseExportOptions(body)),{status:202})}
      if(url.pathname==="/api/catalog/import" && request.method==="POST") {
        const body:unknown=await request.json(),op=operationId(text(body,"operation")),status=operations.status(principal,op)
        if(status.kind!=="ready")throw new Error("import-not-ready")
        const original={bytes:operations.artifact(principal,op),report:status.report}
        const entry=native ? await native.catalog.create(principal,text(body,"requestId"),text(body,"title"),"",decodeCatalogImportV3(status.report),original) : await history.catalog.create(principal,text(body,"requestId"),text(body,"title"),"",parseDeck(status.report.deck),original)
        return Response.json({entry,report:status.report},{status:201})
      }
      if(url.pathname==="/api/catalog" && request.method==="GET")return Response.json(await catalog.list(principal,url.searchParams.get("trash")==="true",url.searchParams.get("search") ?? ""))
      if(url.pathname==="/api/catalog" && request.method==="POST") {
        const body:unknown=await request.json()
        const source=body&&typeof body==="object"&&"starter" in body&&body.starter==="welcome" ? welcomeDeck() : templates ? defaultDeck(templates.default(principal)) : undefined
        const entry=native ? await native.catalog.create(principal,text(body,"requestId"),text(body,"title"),text(body,"pendingRequest"),source ? decodeLegacyCatalogDeckV2(source) : undefined) : await history.catalog.create(principal,text(body,"requestId"),text(body,"title"),text(body,"pendingRequest"),source)
        return Response.json(entry,{status:201})
      }
      if(url.pathname==="/api/catalog/trash" && request.method==="DELETE") {const body:unknown=await request.json();if(text(body,"confirm")!=="empty-trash")throw new Error("confirmation-required");const confirmed=body && typeof body==="object" && "decks" in body ? body.decks : null;if(!Array.isArray(confirmed))throw new Error("confirmation-snapshot-required");const targets=confirmed.map((value:unknown)=>{if(!value || typeof value!=="object" || !("id" in value) || typeof value.id!=="string" || !("generation" in value) || typeof value.generation!=="number" || !Number.isSafeInteger(value.generation))throw new Error("invalid-confirmation-snapshot");return {id:value.id,generation:value.generation}});const removed=await catalog.emptyTrash(principal,targets);await Promise.all(removed.map(changed));return Response.json({removed})}
      const match=/^\/api\/catalog\/([a-zA-Z][a-zA-Z0-9_-]{0,31})(?:\/(star|rename|duplicate|trash|restore|request|view))?$/.exec(url.pathname)
      const deck=match?.[1];if(!deck)return Response.json({code:"not-found"},{status:404})
      if(!match[2] && request.method==="GET")return Response.json(await catalog.details(principal,deck))
      if(match[2]==="view" && request.method==="GET")return Response.json(await catalog.readDeleted(principal,deck))
      if(request.method!=="POST")return Response.json({code:"method-not-allowed"},{status:405})
      const body:unknown=await request.json()
      switch(match[2]) {
        case "star": {if(!body || typeof body!=="object" || !("starred" in body) || typeof body.starred!=="boolean")throw new Error("invalid-starred");return Response.json(await catalog.star(principal,deck,body.starred))}
        case "rename":return Response.json(await catalog.rename(principal,deck,text(body,"title")))
        case "request":return Response.json(await catalog.pending(principal,deck,text(body,"pendingRequest")))
        case "duplicate": {
          const entry=await catalog.details(principal,deck),original=await catalog.original(principal,deck) ?? undefined
          const duplicate=native ? await native.catalog.create(principal,text(body,"requestId"),`${entry.title} copy`,"",(await native.read(principal,deck)).deck,original) : await history.catalog.create(principal,text(body,"requestId"),`${entry.title} copy`,"",(await history.read(principal,deck)).deck,original)
          return Response.json(duplicate,{status:201})
        }
        case "trash": {const entry=await catalog.trash(principal,deck);await changed(deck);return Response.json(entry)}
        case "restore": {const entry=await catalog.restore(principal,deck);await changed(deck);return Response.json(entry)}
        default:return Response.json({code:"not-found"},{status:404})
      }
    }catch(error){const admission=await paragraphFeatureAdmission(paragraphs,request,true);if(admission)return admission;const code=error instanceof Error ? error.message : "catalog-failed";return Response.json({code},{status:code==="deck-not-found" ? 404 : code==="deck-expired" ? 410 : 400})}
  }
}

function defaultDeck(template: import("../../../../packages/brand/src/index.ts").Template) {
  const deck={id:id("newDeck"),version:0,slides:[],themes:[{id:themeId("default"),font:"Geist",background:"#ffffff"}]}
  const result=apply(deck,applyTemplate(deck,template,{kind:"apply-deck"},undefined).changes)
  if (!result.ok) throw new Error(result.error.code)
  return result.deck
}
