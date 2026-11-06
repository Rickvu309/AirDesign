import {createServer} from "node:http"
import {once} from "node:events"
import type {Socket} from "node:net"
import {WebSocket} from "ws"
import {expect,it} from "vitest"
import type {Access} from "../../../packages/access/src/index.ts"
import {fixtureDeck} from "../../../packages/deck/src/fixture.ts"
import {id} from "../../../packages/deck/src/index.ts"
import {commandId} from "../../../packages/change-log/src/index.ts"
import {createHistoryStore} from "../src/db/history-store.ts"
import {attachSync} from "../src/rpc/websocket.ts"

async function harness(){
 const store=await createHistoryStore({kind:"pglite"},()=>1793980800000)
 const owner={personId:"owner"}
 const access:Access={principal:async request=>({personId:request.headers.get("cookie") ?? owner.personId}),handle:async()=>new Response(null,{status:404}),resumeDeletions:async()=>{},close:async()=>{}}
 const server=createServer(),connections:Socket[]=[]
 server.on("connection",socket=>connections.push(socket))
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve))
 const address=server.address()
 if(!address || typeof address==="string")throw new Error("missing-test-address")
 const origin=`http://127.0.0.1:${address.port}`,sync=attachSync(server,access,store,origin)
 const clients:WebSocket[]=[]
 async function open(deck:string,token?:string,person=owner.personId){
  const socket=new WebSocket(`${origin.replace("http","ws")}/ws?deck=${deck}${token ? `&runCredential=${token}` : ""}`,{origin,headers:{cookie:person}})
  const messages:unknown[]=[]
  let responses=0,readyResolve:()=>void=()=>{},responseResolve:()=>void=()=>{}
  const ready=new Promise<void>(resolve=>{readyResolve=resolve})
  socket.on("message",raw=>{
   const value:unknown=JSON.parse(raw.toString())
   if(value && typeof value==="object" && "kind" in value){
    if(value.kind==="snapshot")readyResolve()
    if(value.kind==="receipt" && "receipt" in value){messages.push(value.receipt);responses++;responseResolve()}
    if(value.kind==="error" && "code" in value){messages.push({code:value.code});responses++;responseResolve()}
   }
  })
  clients.push(socket)
  await ready
  const transport=connections.at(-1)
  if(!transport)throw new Error("missing-test-transport")
  return {messages,async send(value:unknown){const arrived=once(transport,"data");socket.send(typeof value==="string" ? value : JSON.stringify(value));await arrived},async wait(count:number){while(responses<count)await new Promise<void>(resolve=>{responseResolve=resolve})}}
 }
 return {store,owner,open,async close(){for(const socket of clients)socket.terminate();sync.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await store.close()}}
}
const patch=(name:string,notes=name)=>({id:name,kind:"patch",base:0,run:null,target:"s0",fields:{notes}})

it("commits A1, B1, A2 in deck arrival order across connections",async()=>{
 const h=await harness()
 try{
  await h.store.create(h.owner,fixtureDeck(2))
  const a=await h.open("deck"),b=await h.open("deck")
  await a.send(patch("A1"));await b.send(patch("B1"));await a.send(patch("A2"))
  await Promise.all([a.wait(2),b.wait(1)])
  expect((await h.store.replay(h.owner,"deck",0)).events.map(event=>event.command.id)).toEqual(["A1","B1","A2"])
 }finally{await h.close()}
})

it("gives malformed messages their own errors and commits both valid neighbors",async()=>{
 const h=await harness()
 try{
  await h.store.create(h.owner,fixtureDeck(2))
  const a=await h.open("deck")
  await a.send(patch("before"));await a.send({kind:"patch"});await a.send(patch("after"));await a.send("{")
  await a.wait(4)
  expect(a.messages).toEqual([{id:"before",kind:"applied",seq:1},{code:"invalid-command"},{id:"after",kind:"applied",seq:2},{code:"invalid-command"}])
  expect((await h.store.replay(h.owner,"deck",0)).events.map(event=>event.command.id)).toEqual(["before","after"])
 }finally{await h.close()}
})

it("matches single processing for seeded random valid, refused, reused and malformed two-connection arrivals including usage exhaustion",async()=>{
 const h=await harness()
 try{
  for(let seed=1;seed<=12;seed++){
   let random=seed
   const next=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random}
   const arrivals=[
    ...Array.from({length:7},(_,index)=>({connection:1,choice:index<2 ? 4 : 6,index})),
    {connection:0,choice:6,index:7},{connection:1,choice:6,index:8},{connection:1,choice:3,index:9},{connection:1,choice:2,index:10},
    ...Array.from({length:32},(_,index)=>({connection:next()%3===0 ? 0 : 1,choice:next()%7,index:index+100})),
   ]
   const outcomes=[]
   for(const mode of ["single","batch"]){
    const deck=id(`trial_${seed}_${mode}`),run="agent",person={personId:`owner_${seed}_${mode}`}
    await h.store.create(person,{...fixtureDeck(2),id:deck})
    await h.store.commit(person,deck,{id:commandId("start"),kind:"start-run",run})
    const token=await h.store.issueRunToken(person,deck,run)
    const sockets=[await h.open(deck,undefined,person.personId),await h.open(deck,token,person.personId)]
    const admission=await h.store.usage.reserve(person.personId,{id:"prefill",actor:"user-agent",request:"prefill",units:9996})
    if(admission.kind!=="admitted")throw new Error("prefill-refused")
    await h.store.usage.settle(person.personId,admission.reservation,"finished")
    const before=(await h.store.usage.status(person.personId)).used
    const messages:unknown[][]=[[],[]]
    for(const arrival of arrivals){
     const socket=sockets[arrival.connection]
     if(!socket)throw new Error("missing-test-client")
     const command={...patch(`cmd_${arrival.index}`),run:arrival.connection===1 ? run : null,base:arrival.index<7 ? 99999 : 1}
     const value=arrival.choice===0 ? {kind:"patch"} : arrival.choice===1 ? "{" : arrival.choice===2 ? {...command,target:"absent"} : arrival.choice===3 ? {...command,base:99999} : arrival.choice===4 ? {...command,id:"reused"} : command
     await socket.send(value)
     messages[arrival.connection]?.push(value)
     if(mode==="single")await socket.wait(messages[arrival.connection]?.length ?? 0)
    }
    await Promise.all(sockets.map((socket,index)=>socket.wait(messages[index]?.length ?? 0)))
    const snapshot=await h.store.read(person,deck)
    outcomes.push({messages:sockets.map(socket=>socket.messages),events:(await h.store.replay(person,deck,0)).events,seq:snapshot.seq,used:(await h.store.usage.status(person.personId)).used-before,deck:{...snapshot.deck,id:"normalized"}})
   }
   expect(outcomes[1],`seed ${seed}`).toEqual(outcomes[0])
   expect(outcomes[1]?.used).toBe(4)
   const codes=outcomes[1]?.messages.flat().flatMap(message=>message && typeof message==="object" && "code" in message ? [message.code] : [])
   expect(codes).toEqual(expect.arrayContaining(["request-id-payload-mismatch","stale-base","person-protected","invalid-reference","out-of-usage","invalid-command"]))
  }
 }finally{await h.close()}
},60_000)
