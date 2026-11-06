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
        let ordered = Promise.resolve()
        let inbox:string[]=[]
        let delivery:ReturnType<typeof setTimeout>|undefined
        websocket.on("close",()=>clearTimeout(delivery))
        websocket.on("message",data=> {
          inbox.push(data.toString())
          if(delivery!==undefined)return
          delivery=setTimeout(()=>{
            delivery=undefined
            const pending=inbox;inbox=[]
            for(let offset=0;offset<pending.length;offset+=100){
              const batch=pending.slice(offset,offset+100)
              ordered = ordered.then(async ()=> {
                const started=performance.now()
                const current = await access.principal(request)
                const authorized=performance.now()
                if (!current || current.personId !== principal.personId) { websocket.send(JSON.stringify({kind:"signed-out"})); websocket.close(); return }
                const bases=[...peers.values()].filter(peer=>peer.deck===deck).map(peer=>peer.seq)
                const base=bases.includes(null) ? null : Math.min(...bases.filter((seq):seq is number=>seq!==null))
                const commands=batch.map(raw=>parseCommand(JSON.parse(raw)))
                const committed=await store.commitBatchSnapshot(current,deck,commands,identity,base)
                const snapshot={...committed.snapshot,committedAt:Date.now()}
                const peer=peers.get(websocket)
                for(const [index,receipt] of committed.receipts.entries()){
                  websocket.send(JSON.stringify({kind:"receipt",receipt,...(index===0 ? snapshotDelta(snapshot,peer?.seq ?? null) : {checkpoint:"previous",deckId:deck,seq:snapshot.seq,committedAt:snapshot.committedAt}),...(committed.profile ? {profile:{...committed.profile,authorizationMs:authorized-started,transactionMs:performance.now()-authorized}} : {})}))
                  if(peer)peer.seq=snapshot.seq
                }
                publish(deck,snapshot)
              }).catch(error=> { if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify({kind:"error",code:error instanceof Error ? error.message : "sync-failed"})) })
            }
          },16)
        })
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
  return { refresh, close() { for(const broadcast of broadcasts.values())clearTimeout(broadcast.timer);broadcasts.clear();for (const socket of peers.keys()) socket.terminate(); sockets.close() } }
}
