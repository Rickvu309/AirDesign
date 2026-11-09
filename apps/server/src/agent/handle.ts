import {paragraphFeatureAdmission} from "../rpc/paragraph-boundary.ts"
import {activeHistory} from "../db/active-history.ts"
import type {ParagraphHistoryStore} from "../db/paragraph-history-store.ts"
import {UsageLimitError} from "../../../../packages/agent/src/activity.ts"
import {randomUUID} from "node:crypto"
import {mutationRejection,type Access} from "@airdesign/access"
import {expectedAgentAbort,runHarness,type AgentAdapter,type AgentContext} from "../../../../packages/agent/src/harness.ts"
import {commandId} from "../../../../packages/change-log/src/index.ts"
import type {HistoryStore} from "../db/history-store.ts"
import type {domainTools} from "../mcp/domain-tools.ts"
import type {AgentRun,ActivityContent} from "./store.ts"
type LiveRun={data:AgentRun;controller:AbortController;task:Promise<void>;requests:Set<(text:string)=>void>}
export function agentHandler(access:Access,history:HistoryStore,tools:ReturnType<typeof domainTools>,origin:string,adapter:AgentAdapter|undefined,changed:(deck:string)=>Promise<void>,paragraphs?:ParagraphHistoryStore){
  const runs=new Map<string,LiveRun>(),subscribers=new Map<string,{owner:string;deck:string;sends:Set<(value:string)=>void>}>()
  let commands=Promise.resolve()
  async function serial<T>(work:()=>Promise<T>){const previous=commands;let release=()=>{};commands=new Promise<void>(resolve=>{release=resolve});await previous;try{return await work()}finally{release()}}
  function append(run:AgentRun,event:ActivityContent){run.events.push({...event,id:(run.events.at(-1)?.id ?? 0)+1});run.events=run.events.slice(-200)}
  const keyOf=(owner:string,deck:string)=>JSON.stringify([owner,deck])
  async function current(owner:string,deck:string){
    const live=runs.get(keyOf(owner,deck));if(live)return live.data
    const saved=await (await activeHistory(history,paragraphs)).agents.latest(owner,deck)
    if(saved?.kind==="working"){saved.kind="failed";append(saved,{kind:"message",text:"Run interrupted. Changes so far stay. Resume to continue."});await (await activeHistory(history,paragraphs)).agents.save(saved)}
    return saved
  }
  async function snapshot(owner:string,deck:string){
    const saved=await (await activeHistory(history,paragraphs)).read({personId:owner},deck)
    const remote=saved.events.filter(event=>event.actor!=="person"&&!event.run?.startsWith("aira_")).slice(-20).map(event=>({id:event.id,run:event.run,active:event.active,targets:event.patches.map(patch=>patch.id)}))
    return {enabled:!!adapter&&await (await activeHistory(history,paragraphs)).agents.enabled(owner),...(!adapter?{unavailable:"Aira is unavailable. The server needs a Claude API key. You can keep editing manually."}:{}),run:await current(owner,deck),remote}
  }
  async function publish(deck:string){await Promise.all([...subscribers.values()].filter(group=>group.deck===deck).map(async group=>{try{const value=JSON.stringify(await snapshot(group.owner,group.deck));for(const send of group.sends)send(value)}catch{for(const send of group.sends)send(JSON.stringify({code:"deck-unavailable"}))}}))}
  async function save(run:AgentRun){await (await activeHistory(history,paragraphs)).agents.save(run);await publish(run.deck)}
  async function closeRun(run:AgentRun){await (await activeHistory(history,paragraphs)).commit({personId:run.owner},run.deck,{id:commandId(`close_${run.id}`),kind:"close-run",run:run.id},{kind:"run",run:run.id});await changed(run.deck)}
  async function stop(live:LiveRun){live.data.kind="stopped";live.controller.abort();await live.task;await save(live.data)}
  async function stopOwnedRuns(owner:string){await Promise.all([...runs.values()].filter(run=>run.data.owner===owner&&run.data.kind==="working").map(stop))}
  async function stopOwner(owner:string){await serial(()=>stopOwnedRuns(owner))}
  async function launch(data:AgentRun){
    const backend=await activeHistory(history,paragraphs)
    if(!adapter)throw new Error("aira-unavailable")
    const selectedAdapter=adapter
    const live:LiveRun={data,controller:new AbortController(),task:Promise.resolve(),requests:new Set()}
    runs.set(keyOf(data.owner,data.deck),live)
    const context:AgentContext={textProtocol:backend.protocol,run:data.id,deckId:data.deck,selection:data.selection,get request(){return data.request},completed:data.completed,subscribeRequest(listener){live.requests.add(listener);return ()=>{live.requests.delete(listener)}}}
    live.task=(async()=>{
      try{
        const call=async(name:string,input:unknown)=>{
          if(live.controller.signal.aborted||!await (await activeHistory(history,paragraphs)).agents.enabled(data.owner))throw new Error("run-stopped")
          return tools.call({personId:data.owner,connection:data.id,airaRun:data.id},name,input)
        }
        for await(const event of runHarness(context,call,live.controller.signal,selectedAdapter)){
          const item:ActivityContent=event.kind==="tool" ? {kind:"tool",name:event.name,...(event.scope ? {scope:event.scope} : {}),...(event.scopes ? {scopes:event.scopes} : {}),...(event.fileName ? {fileName:event.fileName} : {}),...(event.brandApplied ? {brandApplied:true} : {})} : {...event}
          if(item.kind==="tool"&&item.name==="apply_changes")for(const scope of item.scopes ?? (item.scope ? [item.scope] : []))if(!data.completed.includes(scope))data.completed.push(scope)
          append(data,item);await save(data)
        }
        if(data.kind==="working")data.kind="complete"
      }catch(error){if(data.kind!=="stopped"||!expectedAgentAbort(error,live.controller.signal)){if(error instanceof UsageLimitError){data.kind="limited";append(data,{kind:"limit",limit:error.limit})}else{data.kind="failed";append(data,{kind:"message",text:`${error instanceof Error ? error.message : "Run failed"}. Changes so far stay.`})}}}
      finally{
        if(data.kind==="complete")await closeRun(data).catch(()=>undefined)
        await save(data).catch(()=>undefined)
      }
    })()
    return live
  }
  async function handle(request:Request){
    const rejection=mutationRejection(request,origin);if(rejection)return Response.json(rejection,{status:rejection.status})
    const principal=await access.principal(request);if(!principal)return Response.json({code:"signed-out"},{status:401})
    try{
      const url=new URL(request.url),deck=url.searchParams.get("deck") ?? ""
      if(url.pathname==="/api/aira/configure"){
        if(request.method==="GET")return Response.json({enabled:!!adapter&&await (await activeHistory(history,paragraphs)).agents.enabled(principal.personId),...(!adapter?{unavailable:"Aira needs a Claude API key on the server."}:{})})
        const body:unknown=await request.json();if(!body||typeof body!=="object"||!("enabled" in body)||typeof body.enabled!=="boolean")throw new Error("invalid-configuration")
        const enabled=body.enabled
        await serial(async()=>{await (await activeHistory(history,paragraphs)).agents.configure(principal.personId,enabled);if(!enabled)await stopOwnedRuns(principal.personId)})
        return Response.json({enabled:body.enabled})
      }
      await (await activeHistory(history,paragraphs)).read(principal,deck)
      const key=keyOf(principal.personId,deck)
      if(request.method==="GET"&&url.pathname==="/api/aira/events"){
        const initial=JSON.stringify(await snapshot(principal.personId,deck))
        let send:(value:string)=>void=()=>{}
        const stream=new ReadableStream<Uint8Array>({start(controller){send=value=>controller.enqueue(new TextEncoder().encode(`data: ${value}\n\n`));const group=subscribers.get(key) ?? {owner:principal.personId,deck,sends:new Set()};group.sends.add(send);subscribers.set(key,group);send(initial)},cancel(){subscribers.get(key)?.sends.delete(send)}})
        return new Response(stream,{headers:{"content-type":"text/event-stream","cache-control":"no-cache"}})
      }
      if(request.method==="GET")return Response.json(await snapshot(principal.personId,deck))
      const body:unknown=await request.json();if(!body||typeof body!=="object"||!("action" in body))throw new Error("invalid-agent-command")
      return await serial(async()=>{
        const active=await current(principal.personId,deck),live=runs.get(key)
        if(body.action==="stop"&&live){await stop(live);return Response.json({id:live.data.id,kind:live.data.kind})}
        if(body.action==="undo"&&active){
          if(live?.data.kind==="working")await stop(live)
          const before=await (await activeHistory(history,paragraphs)).read(principal,deck),events=before.events
          const affected=new Set(events.filter(event=>event.run===active.id).flatMap(event=>event.patches.map(patch=>patch.id)))
          const epoch=before.runs.find(run=>run.id===active.id)?.epoch ?? 0
          const kept=[...new Set(events.filter(event=>event.actor==="person"&&event.active&&event.seq>epoch).flatMap(event=>event.patches.map(patch=>patch.id)).filter(id=>affected.has(id)))]
          const receipt=await (await activeHistory(history,paragraphs)).commit(principal,deck,{id:commandId(`undo_${active.id}`),kind:"undo-run",run:active.id})
          if(receipt.kind!=="applied")throw new Error(receipt.code)
          active.kind="undone";await changed(deck);await save(active);return Response.json({...receipt,kept})
        }
        if(!adapter)throw new Error("aira-unavailable")
        if(!await (await activeHistory(history,paragraphs)).agents.enabled(principal.personId))throw new Error("aira-disabled")
        if(body.action==="resume"&&(active?.kind==="failed"||active?.kind==="stopped"||active?.kind==="limited")){active.kind="working";await launch(active);await save(active);return Response.json({id:active.id,kind:active.kind},{status:202})}
        if(body.action!=="send"||!("text" in body)||typeof body.text!=="string"||!body.text.trim()||body.text.length>8000)throw new Error("invalid-agent-request")
        if(active?.kind==="working"){
          active.request=body.text;for(const listener of live?.requests ?? [])listener(body.text);append(active,{kind:"message",text:body.text});await save(active);return Response.json({id:active.id,kind:active.kind,joined:true})
        }
        const selection="selection" in body ? body.selection : []
        if(!Array.isArray(selection)||selection.length>100||!selection.every((value):value is string=>typeof value==="string"&&value.length<=100))throw new Error("invalid-selection")
        const data:AgentRun={id:`aira_${randomUUID().replaceAll("-","")}`,owner:principal.personId,deck,request:body.text,selection:[...new Set(selection)],kind:"working",events:[],completed:[]}
        const start=await (await activeHistory(history,paragraphs)).commit(principal,deck,{id:commandId(`start_${data.id}`),kind:"start-run",run:data.id})
        if(start.kind!=="applied")throw new Error(start.code)
        await launch(data);await save(data)
        return Response.json({id:data.id,kind:data.kind},{status:202})
      })
    }catch(error){const admission=await paragraphFeatureAdmission(paragraphs,request);if(admission)return admission;return Response.json({code:error instanceof Error ? error.message : "agent-failed"},{status:400})}
  }
  return {handle,publish,stopOwner,async close(){await Promise.all([...runs.values()].filter(run=>run.data.kind==="working").map(stop));await tools.close()}}
}
