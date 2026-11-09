import { WebSocketServer, WebSocket } from "ws"
import type { Server } from "node:http"
import type { Access } from "@airdesign/access"
import type { HistoryStore } from "../db/history-store.ts"
import { parseCommand } from "../../../../packages/rpc/src/parse-command.ts"
import type { Snapshot } from "../../../../packages/rpc/src/client.ts"
import { snapshotDelta } from "../../../../packages/rpc/src/snapshot-delta.ts"
export function attachSync(server: Server, access: Access, store: HistoryStore, origin: string) {
  const sockets = new WebSocketServer({noServer:true,maxPayload:1_048_576})
  const peers = new Map<WebSocket,{deck:string;request:Request;personId:string;seq:number|null}>()
  async function refresh(deck: string, snapshot?: Snapshot & {committedAt?:number}, except?: WebSocket) {
    await Promise.all([...peers].filter(([socket,peer])=>peer.deck===deck && socket!==except).map(async ([socket,peer])=> {
      try {
        const principal = await access.principal(peer.request)
        if (!principal || principal.personId !== peer.personId) { socket.send(JSON.stringify({kind:"signed-out"})); socket.close(); return }
        const current = snapshot ? snapshotDelta(snapshot,peer.seq) : peer.seq===null ? await store.read(principal,deck) : await store.delta(principal,deck,peer.seq)
        if (socket !== except && socket.readyState === WebSocket.OPEN && (peer.seq===null || current.seq>=peer.seq)) {socket.send(JSON.stringify({kind:"snapshot",...current}));peer.seq=current.seq}
      } catch (error) {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({kind:"error",code:error instanceof Error ? error.message : "sync-failed"}))
      }
    }))
  }
  type Arrival = {websocket:WebSocket; raw:string; deliver:(batch:string[])=>Promise<void>}
  const arrivals=new Map<string,{pending:Arrival[];ordered:Promise<void>;timer:ReturnType<typeof setTimeout>|undefined}>()
  function enqueue(deck:string,arrival:Arrival){
    let queue=arrivals.get(deck)
    if(!queue){queue={pending:[],ordered:Promise.resolve(),timer:undefined};arrivals.set(deck,queue)}
    queue.pending.push(arrival)
    if(queue.timer!==undefined)return
    const current=queue
    current.timer=setTimeout(()=>{
      current.timer=undefined
      const pending=current.pending;current.pending=[]
      for(let offset=0;offset<pending.length;){
        const first=pending[offset]
        if(!first)break
        const batch:string[]=[]
        while(offset<pending.length && pending[offset]?.websocket===first.websocket && batch.length<100){
          const next=pending[offset++]
          if(next)batch.push(next.raw)
        }
        current.ordered=current.ordered.then(()=>first.deliver(batch)).catch(error=>{
          if(first.websocket.readyState===WebSocket.OPEN)first.websocket.send(JSON.stringify({kind:"error",code:error instanceof Error ? error.message : "sync-failed"}))
        })
      }
      const drained=current.ordered
      void drained.then(()=>{if(current.ordered===drained && current.timer===undefined && current.pending.length===0 && arrivals.get(deck)===current)arrivals.delete(deck)})
    },16)
  }
  const broadcasts=new Map<string,{snapshot:Snapshot & {committedAt?:number};timer:ReturnType<typeof setTimeout>}>()
  function publish(deck:string,snapshot:Snapshot & {committedAt?:number}){
    const pending=broadcasts.get(deck)
    if(pending){pending.snapshot=snapshot;return}
    const broadcast={snapshot,timer:setTimeout(()=>{
      broadcasts.delete(deck)
      void refresh(deck,broadcast.snapshot)
    },16)}
    broadcasts.set(deck,broadcast)
  }
  server.on("upgrade",(incoming,socket,head)=> {
    void (async ()=> {
      const url = new URL(incoming.url ?? "/",origin)
      const deck = url.searchParams.get("deck")
      const after=Number(url.searchParams.get("after") ?? 0)
      if (url.pathname !== "/ws" || incoming.headers.origin !== new URL(origin).origin || !deck || !/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(deck) || !Number.isSafeInteger(after) || after<0) { socket.destroy(); return }
      const request = new Request(new URL("/api/account",origin),{headers:{cookie:incoming.headers.cookie ?? ""}})
      const principal = await access.principal(request)
      if (!principal) { socket.destroy(); return }
      const token=url.searchParams.get("runCredential")
      const identity=token ? await store.runIdentity(principal,deck,token) : {kind:"person" as const}
      await store.read(principal,deck)
      sockets.handleUpgrade(incoming,socket,head,websocket=> {
        peers.set(websocket,{deck,request,personId:principal.personId,seq:null})
        websocket.on("error",()=>websocket.close())
        websocket.on("close",()=>peers.delete(websocket))
        const deliver=async(batch:string[])=>{
          const started=performance.now()
          const current=await access.principal(request)
          const authorized=performance.now()
          if(!current || current.personId!==principal?.personId){websocket.send(JSON.stringify({kind:"signed-out"}));websocket.close();return}
          const bases=[...peers.values()].filter(peer=>peer.deck===deck).map(peer=>peer.seq)
          const base=bases.includes(null) ? null : Math.min(...bases.filter((seq):seq is number=>seq!==null))
          const parsed=batch.map(raw=>{
            try{return {kind:"command" as const,command:parseCommand(JSON.parse(raw))}}
            catch(error){return {kind:"error" as const,code:error instanceof SyntaxError ? "invalid-command" : error instanceof Error ? error.message : "invalid-command"}}
          })
          const commands=parsed.flatMap(item=>item.kind==="command" ? [item.command] : [])
          const committed=commands.length ? await store.commitBatchSnapshot(current,deck,commands,identity,base) : null
          const snapshot=committed ? {...committed.snapshot,committedAt:Date.now()} : null
          const peer=peers.get(websocket)
          let index=0,checkpointSent=false
          for(const item of parsed){
            const result=item.kind==="error" ? item : committed?.results[index++]
            if(!result)throw new Error("missing-command-result")
            if(result.kind==="error"){websocket.send(JSON.stringify(result));continue}
            if(!snapshot)throw new Error("missing-command-snapshot")
            websocket.send(JSON.stringify({kind:"receipt",receipt:result.receipt,...(!checkpointSent ? snapshotDelta(snapshot,peer?.seq ?? null) : {checkpoint:"previous",deckId:deck,seq:snapshot.seq,committedAt:snapshot.committedAt}),...(committed?.profile ? {profile:{...committed.profile,authorizationMs:authorized-started,transactionMs:performance.now()-authorized}} : {})}))
            checkpointSent=true
            if(peer)peer.seq=snapshot.seq
          }
          if(snapshot)publish(deck,snapshot)
        }
        websocket.on("message",data=>enqueue(deck,{websocket,raw:data.toString(),deliver}))
        void (async ()=> {
          let cursor=after
          while (websocket.readyState===WebSocket.OPEN) {
            const page=await store.replay(principal,deck,cursor)
            websocket.send(JSON.stringify({kind:"replay",...page}))
            const last=page.events.at(-1)
            if (!last || last.seq>=page.head) break
            cursor=last.seq
          }
          await refresh(deck)
        })().catch(()=>websocket.close())
      })
    })().catch(()=>socket.destroy())
  })
  return { refresh, close() { for(const queue of arrivals.values())clearTimeout(queue.timer);arrivals.clear();for(const broadcast of broadcasts.values())clearTimeout(broadcast.timer);broadcasts.clear();for (const socket of peers.keys()) socket.terminate(); sockets.close() } }
}
