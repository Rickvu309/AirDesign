import {AsyncLocalStorage} from "node:async_hooks"
import {createSdkMcpServer, query, tool, type Options} from "@anthropic-ai/claude-agent-sdk"
import {z} from "zod"
import {Client} from "@modelcontextprotocol/sdk/client/index.js"
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js"
import {toolCatalog} from "../../tools/src/catalog.ts"
type AgentBoundary={signal:AbortSignal;fail:(error:unknown)=>void}
export const agentBoundary=new AsyncLocalStorage<AgentBoundary>()
export function expectedAgentAbort(error:unknown,signal:AbortSignal){return signal.aborted&&error instanceof Error&&(error.message==="Operation aborted"||error.message==="Claude Code process aborted by user"||error.name==="AbortError")}
process.on("unhandledRejection",error=>{
  const boundary=agentBoundary.getStore()
  if(!boundary)throw error
  if(!expectedAgentAbort(error,boundary.signal))boundary.fail(error)
})
export const agentSdkPin = "0.2.31"
export type AgentContext = {run:string;deckId:string;selection:string[];request:string;completed?:string[]}
export type AgentActivity = {kind:"tool";name:string;result:unknown;scope?:string} | {kind:"message";text:string}
export type AgentTools = (name:string,input:unknown)=>Promise<{content:({type:"text";text:string}|{type:"image";mimeType:string;data:string})[];isError?:boolean}>
export type AgentAdapter = (context:AgentContext,call:AgentTools,signal:AbortSignal)=>AsyncIterable<AgentActivity>
export function sdkHarness(call:AgentTools) {
  const tools=toolCatalog.map(definition=>tool(definition.name,definition.description,{input:z.fromJSONSchema(z.record(z.string(),z.json()).parse(definition.inputSchema))},args=>call(definition.name,args.input)))
  const server=createSdkMcpServer({name:"airdesign",version:"0.1.0",tools})
  const options:Options={mcpServers:{airdesign:server},tools:[],allowedTools:toolCatalog.map(entry=>`mcp__airdesign__${entry.name}`),persistSession:false,maxTurns:20}
  return {server,options,query}
}
export async function* runHarness(context:AgentContext,call:AgentTools,signal:AbortSignal,adapter:AgentAdapter):AsyncIterable<AgentActivity> {
  const harness=sdkHarness(call)
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair()
  const client=new Client({name:"aira-local-adapter",version:"0.1.0"})
  await harness.server.instance.connect(serverTransport)
  await client.connect(clientTransport)
  const dispatch:AgentTools=async(name,input)=>{
    const result=await client.callTool({name,arguments:{input}})
    const parsed=z.object({content:z.array(z.union([z.object({type:z.literal("text"),text:z.string()}),z.object({type:z.literal("image"),mimeType:z.string(),data:z.string()})])),isError:z.boolean().optional()}).parse(result)
    return parsed
  }
  const controller=new AbortController()
  const abort=()=>controller.abort()
  signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort()
  let rejectFailure:(error:unknown)=>void=()=>{}
  const failure=new Promise<never>((_,reject)=>{rejectFailure=reject})
  const fail=(error:unknown)=>{rejectFailure(error);controller.abort()}
  const iterator=adapter(context,dispatch,controller.signal)[Symbol.asyncIterator]()
  try {
    for(;;){
      const event=await agentBoundary.run({signal,fail},()=>Promise.race([iterator.next(),failure]))
      if(event.done)return
      yield event.value
    }
  } catch(error){if(!expectedAgentAbort(error,signal))throw error}
  finally {
    signal.removeEventListener("abort",abort);controller.abort()
    try{await iterator.return?.().catch(error=>{if(!expectedAgentAbort(error,signal))throw error})}
    finally{try{await client.close()}finally{await harness.server.instance.close()}}
  }
}
