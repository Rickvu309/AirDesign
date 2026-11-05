import assert from "node:assert/strict"
import { once } from "node:events"
import { execFileSync } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { chromium } from "playwright/test"
import WebSocket from "ws"
import { localStack, signIn } from "./local-stack.mjs"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
const stack=await localStack(),browser=await chromium.launch(),context=await browser.newContext()
const sockets=[]
try {
 await signIn(context,stack.origin,"execution-identity@example.com")
 const deck="authoritycheck",headers={origin:stack.origin},receipts=[]
 assert.equal((await context.request.post(stack.origin+"/api/decks",{headers,data:{...fixtureDeck(2),id:deck}})).status(),201)
 const endpoint=stack.origin+"/api/decks/"+deck+"/commands"
 const post=async(command,credential)=>{
  const response=await context.request.post(endpoint,{headers:{...headers,...(credential ? {"x-run-credential":credential} : {})},data:command})
  assert.equal(response.status(),200)
  const receipt=await response.json();receipts.push(receipt);return receipt
 }
 const start=await post({id:"start",kind:"start-run",run:"trusted"})
 assert.equal(start.kind,"applied")
 const patch=(id,run)=>({id,kind:"patch",run,base:1,target:"s0",fields:{notes:id}})
 const refused=receipt=>assert.equal(receipt.code,"execution-identity-mismatch")
 refused(await post(patch("http_person_forgery","trusted")))
 assert.equal(typeof start.runCredential,"string")
 refused(await post(patch("http_run_person",null),start.runCredential))
 refused(await post(patch("http_run_other","other"),start.runCredential))
 assert.equal((await post(patch("http_run_write","trusted"),start.runCredential)).kind,"applied")
 const cookie=(await context.cookies()).map(item=>`${item.name}=${item.value}`).join("; ")
 const connect=async credential=>{
  const socket=new WebSocket(stack.api.replace("http:","ws:")+"/ws?deck="+deck+(credential ? "&runCredential="+credential : ""),{headers:{origin:stack.origin,cookie}})
  sockets.push(socket);await once(socket,"open");return socket
 }
 const send=(socket,command)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.off("message",message);reject(new Error("receipt-timeout"))},10000)
  function message(data){const value=JSON.parse(String(data));if(value.kind==="receipt" && value.receipt.id===command.id){clearTimeout(timer);socket.off("message",message);receipts.push(value.receipt);resolve(value.receipt)}}
  socket.on("message",message);socket.send(JSON.stringify(command))
 })
 const person=await connect(),run=await connect(start.runCredential)
 refused(await send(person,patch("ws_person_forgery","trusted")))
 refused(await send(run,patch("ws_run_person",null)))
 refused(await send(run,patch("ws_run_other","other")))
 assert.equal((await send(run,{...patch("ws_run_write","trusted"),base:2})).kind,"applied")
 assert.equal((await send(person,patch("ws_person_write",null))).kind,"applied")
 const result={head,verdict:"pass",transports:["http","websocket"],receipts}
 if(process.env.P04_AUTHORITY_OUTPUT)await writeFile(process.env.P04_AUTHORITY_OUTPUT,JSON.stringify(result,null,2))
 process.stdout.write(JSON.stringify({head,verdict:"pass",transports:result.transports,receipts:receipts.length})+"\n")
}finally{for(const socket of sockets)socket.terminate();await context.close();await browser.close();await stack.close()}
