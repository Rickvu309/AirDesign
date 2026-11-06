import {it,expect} from "vitest"
import {spawnSync} from "node:child_process"
import {expectedAgentAbort} from "../src/harness.ts"
import {configuredAgent,claudeAdapter,type SdkQuery} from "../src/sdk-adapter.ts"
it("disables Aira without a key and wires the pinned SDK model and cancellation without API calls",async()=>{
 expect(configuredAgent({})).toBeUndefined()
 expect(configuredAgent({AIRDESIGN_CLAUDE_KEY:"test-only"})).toBeTypeOf("function")
 const controller=new AbortController()
 const query:SdkQuery=async function*({options}){
  yield* []
  expect(options?.model).toBe("pinned-test-model")
  expect(options?.env?.ANTHROPIC_API_KEY).toBe("test-only")
  expect(options?.tools).toEqual([])
  expect(options?.allowedTools?.length).toBeGreaterThan(0)
  expect(options?.abortController).toBeInstanceOf(AbortController)
  controller.abort()
  expect(options?.abortController?.signal.aborted).toBe(true)
  throw new DOMException("Operation aborted","AbortError")
 }
 const adapter=claudeAdapter({key:"test-only",model:"pinned-test-model",query})
 for await(const event of adapter({run:"test",deckId:"deck",request:"request",selection:[]},async()=>({content:[]}),controller.signal))expect(event).toBeUndefined()
})
it.each(["abort","unexpected"])("contains detached %s SDK transport writes at process level",mode=>{
 const result=spawnSync(process.execPath,["--input-type=module","-e",`
 import {runHarness} from ${JSON.stringify(process.env.FIX1_ORIGINAL_HARNESS ?? "./packages/agent/src/harness.ts")}
 const controller=new AbortController()
 const adapter=async function*(context,call,signal){
  yield {kind:"tool",name:"apply_changes",result:{content:[]},scope:"saved"}
  await new Promise(resolve=>{if(signal.aborted)resolve();else signal.addEventListener("abort",resolve,{once:true})})
  void Promise.reject(new Error(${JSON.stringify(mode==="abort"?"Operation aborted":"unexpected transport failure")}))
  await new Promise(resolve=>setImmediate(resolve))
  throw new DOMException("Operation aborted","AbortError")
 }
 let saved=false,failed=false
 try{for await(const event of runHarness({run:"run",deckId:"deck",request:"request",selection:[]},async()=>({content:[]}),controller.signal,adapter)){saved=event.scope==="saved";controller.abort()}}catch(error){failed=error.message==="unexpected transport failure"}
 await new Promise(resolve=>setImmediate(resolve))
 if(!saved||failed!==${mode==="unexpected"})process.exit(2)
 console.log("server-alive; completed change kept; expected run outcome")
 `],{encoding:"utf8",timeout:10000})
 expect(result.stderr).toBe("")
 expect(result.status).toBe(0)
 expect(result.stdout).toContain("server-alive")
})

it("recognizes the pinned SDK cancellation only after Stop",()=>{
 const controller=new AbortController(),error=new Error("Claude Code process aborted by user")
 expect(expectedAgentAbort(error,controller.signal)).toBe(false)
 controller.abort()
 expect(expectedAgentAbort(error,controller.signal)).toBe(true)
 expect(expectedAgentAbort(new Error("unexpected transport failure"),controller.signal)).toBe(false)
})
