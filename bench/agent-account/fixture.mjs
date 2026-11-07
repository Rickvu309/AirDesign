import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import assert from "node:assert/strict"
import {preview} from "vite"
import {mcpFixture,toolValue} from "../../apps/server/test/mcp/fixture.ts"
import {eventStream,deferred} from "../../apps/server/test/agent/stream.ts"
import {localAdapter} from "../../packages/agent/src/local-adapter.ts"
import {localPaymentProvider} from "../../packages/usage/src/payments/provider.ts"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {createWithBrowserOrigin} from "./browser-origin.ts"
export {toolValue,deferred}
export const execute=promisify(execFile)
export const evidence=process.env.P08_EVIDENCE ?? path.join(os.homedir(),"tmp/airdesign-autopilot/P08")
export const head=(await execute("git",["rev-parse","HEAD"])).stdout.trim()
export async function save(file,value){await mkdir(path.dirname(path.join(evidence,file)),{recursive:true});await writeFile(path.join(evidence,file),typeof value==="string" ? value : JSON.stringify(value,null,2)+"\n")}
export async function scenario({browserEnabled=false}={}){
  let gate=null
  const runSources=new Map()
  const commits=[]
  const adapter=async function*(context,call,signal){
    const pause=async current=>{gate=null;current.entered.resolve();await Promise.race([current.release.promise,new Promise(resolve=>{if(signal.aborted)resolve();else signal.addEventListener("abort",resolve,{once:true})})]);if(current.fail&&!signal.aborted)throw new Error("Local adapter interrupted at a change")}
    const source=runSources.get(context.deckId)
    if(source){const result=await call("read_file",{fileId:source.fileId});if(result.isError)throw new Error("source-read-failed");yield {kind:"tool",name:"read_file",result,fileName:source.name}}
    const traced=async(name,input)=>{if(name==="apply_changes"&&gate?.phase==="before"&&gate.skip===0)await pause(gate);signal.throwIfAborted();const start=performance.now(),result=await call(name,input);if(name==="apply_changes")commits.push({run:context.run,input,result,start,ack:performance.now(),ackWall:Date.now()});return result}
    for await(const activity of localAdapter(context,traced,signal)){
      yield activity
      if(activity.kind==="tool"&&activity.name==="apply_changes"&&gate){if(gate.skip>0)gate.skip--;else if(gate.phase==="after")await pause(gate)}
    }
  }
  const create=publicOrigin=>mcpFixture({...publicOrigin ? {publicOrigin} : {},agentAdapter:adapter,paymentProvider:localPaymentProvider("dev-only-local-payment-fixture")})
  const fixture=await (browserEnabled ? createWithBrowserOrigin(create) : create()),origin=fixture.origin,port=Number(new URL(origin).port),trace=[],streams=[],sessions=new Set(),previous=process.env.AIRDESIGN_API_ORIGIN
  let vite
  try{if(browserEnabled){process.env.AIRDESIGN_API_ORIGIN=fixture.apiOrigin;vite=await preview({root:path.resolve("apps/studio"),configFile:path.resolve("apps/studio/vite.config.ts"),preview:{host:"127.0.0.1",port,strictPort:true,proxy:{"/api":fixture.apiOrigin,"/ws":{target:fixture.apiOrigin,ws:true},"/mcp":{target:fixture.apiOrigin,changeOrigin:false},"/oauth":fixture.apiOrigin}}})}}catch(error){await fixture.close();if(previous===undefined)delete process.env.AIRDESIGN_API_ORIGIN;else process.env.AIRDESIGN_API_ORIGIN=previous;throw error}
  const provider=localPaymentProvider("dev-only-local-payment-fixture")
  async function request(owner,url,body,expected=200){const response=await fixture.json(url,body,owner?.cookie ?? ""),value=await response.json();trace.push({url,method:body===undefined ? "GET" : "POST",body,status:response.status,value});assert.equal(response.status,expected,JSON.stringify(value));return value}
  async function webhook(event,forged=false){const signed=provider.sign(event),response=await fetch(fixture.apiOrigin+"/api/billing/webhook",{method:"POST",headers:{"x-payment-signature":forged ? "0".repeat(64) : signed.signature},body:signed.body}),value=await response.json();trace.push({url:"/api/billing/webhook",body:event,status:response.status,value});assert.equal(response.status,forged ? 400 : 200);return value}
  async function stream(owner,id){const value=await eventStream(fixture.apiOrigin+`/api/aira/events?deck=${id}`,owner.cookie);streams.push(value);await value.next();return value}
  async function until(source,predicate){for(;;){const value=await source.next();if(predicate(value))return value}}
  async function run(owner,id,text,selection=[]){const source=await stream(owner,id),started=await request(owner,`/api/aira?deck=${id}`,{action:"send",text,selection},202),snapshot=await until(source,value=>value.run?.id===started.id&&value.run.kind!=="working");return snapshot.run}
  async function deck(owner,id,slides=2){const value={...fixtureDeck(2,slides),id};await request(owner,"/api/decks",value,201);return value}
  async function browser(session,...args){sessions.add(session);const {stdout,stderr}=await execute("agent-browser",["--session",session,...args],{maxBuffer:2*1024*1024,timeout:60000});trace.push({browser:session,args:args[0]==="cookies" ? ["cookies","redacted"] : args,stdout,stderr});return stdout}
  async function login(session,owner){for(const pair of owner.cookie.split("; ")){const i=pair.indexOf("=");await browser(session,"cookies","set",pair.slice(0,i),pair.slice(i+1),"--url",origin)}}
  async function open(session,url,selector){await browser(session,"open",origin+url);await browser(session,"wait","--fn",`Boolean(document.querySelector(${JSON.stringify(selector)}))`)}
  async function click(session,label){const snapshot=await browser(session,"snapshot","-i"),line=snapshot.split("\n").find(line=>line.includes(`button "${label}"`));assert.ok(line,`${label} absent: ${snapshot}`);const ref=line.match(/ref=(e\d+)/)?.[1];assert.ok(ref);await browser(session,"click",`@${ref}`)}
  async function capture(session,name){for(const width of [1440,320]){await browser(session,"set","viewport",String(width),"960");await browser(session,"screenshot",path.join(evidence,"review",`${name}-${width}.png`));await save(`review/${name}-${width}.tree.txt`,await browser(session,"snapshot"))}await browser(session,"set","viewport","1440","960")}
  return {fixture,origin,trace,commits,runSources,request,webhook,provider,stream,until,run,deck,browser,login,open,click,capture,hold(fail=false,phase="after",skip=0){assert.equal(gate,null);gate={entered:deferred(),release:deferred(),fail,phase,skip};return gate},async close(){for(const source of streams)await source.close();for(const session of sessions)await browser(session,"close").catch(()=>undefined);if(vite){vite.httpServer.closeAllConnections();await new Promise(resolve=>vite.httpServer.close(resolve))}await fixture.close();if(previous===undefined)delete process.env.AIRDESIGN_API_ORIGIN;else process.env.AIRDESIGN_API_ORIGIN=previous}}
}
