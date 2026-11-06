import {createSdkMcpServer, query, tool, type Options} from "@anthropic-ai/claude-agent-sdk"
import {z} from "zod"
import {Client} from "@modelcontextprotocol/sdk/client/index.js"
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js"
import {toolCatalog} from "../../tools/src/catalog.ts"
export const agentSdkPin = "0.2.31"
export type AgentContext = {run:string;deckId:string;selection:string[];request:string;completed?:string[]}
export type AgentActivity = {kind:"tool";name:string;result:unknown;scope?:string} | {kind:"message";text:string}
export type AgentTools = (name:string,input:unknown)=>Promise<{content:({type:"text";text:string}|{type:"image";mimeType:string;data:string})[];isError?:boolean}>
export type AgentAdapter = (context:AgentContext,call:AgentTools,signal:AbortSignal)=>AsyncIterable<AgentActivity>
export function sdkHarness(call:AgentTools) {
  const tools=toolCatalog.map(definition=>tool(definition.name,definition.description,{input:z.unknown()},args=>call(definition.name,args.input)))
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
  try {
    for await(const event of adapter(context,dispatch,signal)) {
      if(signal.aborted)return
      yield event
    }
  } finally {await client.close();await harness.server.instance.close()}
}
