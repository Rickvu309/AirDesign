import {agentBoundary,expectedAgentAbort, sdkHarness,type AgentAdapter,type AgentActivity} from "./harness.ts"
import {UsageLimitError,usageLimitSchema} from "./activity.ts"
import {z} from "zod"

export type SdkQuery=(input:Parameters<ReturnType<typeof sdkHarness>["query"]>[0])=>AsyncIterable<import("@anthropic-ai/claude-agent-sdk").SDKMessage>
export function claudeAdapter(configuration:{key:string;model:string;query?:SdkQuery}):AgentAdapter{
  return async function*(context,call,signal){
    const controller=new AbortController(),queue:AgentActivity[]=[]
    let notify=()=>{},done=false,failure:unknown
    const fail=(error:unknown)=>{failure=error;controller.abort();notify()}
    const abort=()=>controller.abort()
    signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort()
    const harness=sdkHarness(async(name,input)=>{
      if(signal.aborted)throw new DOMException("Operation aborted","AbortError")
      const result=await call(name,input)
      if(result.isError){
        for(const part of result.content)if(part.type==="text"){
          let value:unknown
          try{value=JSON.parse(part.text)}catch{continue}
          const limit=z.object({error:z.object({details:usageLimitSchema})}).safeParse(value)
          if(limit.success){const error=new UsageLimitError(limit.data.error.details);fail(error);throw error}
        }
      }else {
        const read=z.object({slideId:z.string()}).safeParse(input)
        const write=z.object({changes:z.array(z.object({target:z.string().optional(),value:z.object({template:z.unknown().optional()}).passthrough().optional()}))}).safeParse(input)
        const file=result.content.flatMap(part=>{if(part.type!=="text")return [];try{const parsed=z.object({ok:z.literal(true),data:z.object({name:z.string()})}).safeParse(JSON.parse(part.text));return parsed.success ? [parsed.data.data.name] : []}catch{return []}})[0]
        const scopes=write.success ? write.data.changes.flatMap(change=>change.target ? [change.target] : []) : []
        queue.push({kind:"tool",name,result,...(name==="get_slide"&&read.success ? {scope:read.data.slideId} : name==="apply_changes"&&write.success ? {scope:scopes[0],scopes,...(write.data.changes.some(change=>change.value?.template!==undefined) ? {brandApplied:true} : {})} : {}),...(name==="read_file"&&file ? {fileName:file} : {})})
      }
      notify();return result
    })
    const env:NodeJS.ProcessEnv={...process.env,ANTHROPIC_API_KEY:configuration.key,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:"1",DISABLE_NON_ESSENTIAL_MODEL_CALLS:"1"}
    delete env.CLAUDE_CODE_OAUTH_TOKEN
    const initial=JSON.stringify({deckId:context.deckId,run:context.run,selection:context.selection,completed:context.completed??[],request:context.request})
    const messages:import("@anthropic-ai/claude-agent-sdk").SDKUserMessage[]=[]
    let wakeInput=()=>{},inputClosed=false
    const enqueue=(text:string)=>{if(inputClosed)throw new Error("aira-run-finishing-retry");messages.push({type:"user",message:{role:"user",content:text},parent_tool_use_id:null,session_id:""});wakeInput()}
    enqueue(initial)
    const unsubscribe=context.subscribeRequest?.(enqueue)
    const closeInput=()=>{inputClosed=true;wakeInput()}
    controller.signal.addEventListener("abort",closeInput,{once:true});if(controller.signal.aborted)closeInput()
    const prompt=async function*(){
      while(!inputClosed||messages.length){
        const message=messages.shift()
        if(message)yield message
        else await new Promise<void>(resolve=>{wakeInput=resolve;if(inputClosed||messages.length)resolve()})
      }
    }
    const task=agentBoundary.run({signal,fail},async()=>{
      try{
        const run=(configuration.query??harness.query)({prompt:prompt(),options:{...harness.options,env,model:configuration.model,abortController:controller,settingSources:[],systemPrompt:"You are Aira. Build and refine executive decks using only AirDesign tools. Read the deck first. Use unique request ids including the run id. Preserve completed changes on resume; inspect current state before editing. Follow the user request and selected content.",includePartialMessages:true}})
        for await(const event of run){
          if(event.type==="assistant")for(const part of event.message.content)if(part.type==="text")queue.push({kind:"message",text:part.text})
          if(event.type==="result"){
            closeInput()
            if(event.is_error)throw new Error(`Claude run failed: ${event.subtype}`)
          }
          notify()
        }
      }catch(error){if(!expectedAgentAbort(error,signal))failure??=error}
      finally{closeInput();done=true;notify()}
    })
    try{
      while(!done||queue.length){
        const event=queue.shift()
        if(event)yield event
        else await new Promise<void>(resolve=>{notify=resolve;if(done)resolve()})
      }
      await task
      if(failure)throw failure
    }finally{unsubscribe?.();controller.abort();controller.signal.removeEventListener("abort",closeInput);signal.removeEventListener("abort",abort);await task}
  }
}
export function configuredAgent(environment:NodeJS.ProcessEnv=process.env):AgentAdapter|undefined{
  const key=environment.AIRDESIGN_CLAUDE_KEY||environment.ANTHROPIC_API_KEY
  return key?claudeAdapter({key,model:environment.AIRDESIGN_CLAUDE_MODEL||"claude-sonnet-5-5"}):undefined
}
