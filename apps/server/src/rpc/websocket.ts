import { WebSocketServer, WebSocket } from "ws"
import type { Server } from "node:http"
import type { Access } from "@airdesign/access"
import type { HistoryStore } from "../db/history-store.ts"
import { parseCommand } from "../../../../packages/rpc/src/parse-command.ts"
import type { Snapshot } from "../../../../packages/rpc/src/client.ts"
export function attachSync(server: Server, access: Access, store: HistoryStore, origin: string) {
  const sockets = new WebSocketServer({noServer:true,maxPayload:1_048_576})
  const peers = new Map<WebSocket,{deck:string;request:Request;personId:string}>()
  async function refresh(deck: string, snapshot?: Snapshot & {committedAt?:number}, except?: WebSocket) {
    await Promise.all([...peers].filter(([,peer])=>peer.deck===deck).map(async ([socket,peer])=> {
      try {
        const principal = await access.principal(peer.request)
        if (!principal || principal.personId !== peer.personId) { socket.send(JSON.stringify({kind:"signed-out"})); socket.close(); return }
        const current = snapshot ?? await store.read(principal,deck)
        if (socket !== except && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({kind:"snapshot",...current}))
      } catch (error) {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({kind:"error",code:error instanceof Error ? error.message : "sync-failed"}))
      }
    }))
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
        peers.set(websocket,{deck,request,personId:principal.personId})
        websocket.on("error",()=>websocket.close())
        websocket.on("close",()=>peers.delete(websocket))
        let ordered = Promise.resolve()
        websocket.on("message",data=> {
          ordered = ordered.then(async ()=> {
            const current = await access.principal(request)
            if (!current || current.personId !== principal.personId) { websocket.send(JSON.stringify({kind:"signed-out"})); websocket.close(); return }
            const receipt = await store.commit(current,deck,parseCommand(JSON.parse(data.toString())),identity)
            const committedAt=Date.now()
            const snapshot={...await store.read(current,deck),committedAt}
            websocket.send(JSON.stringify({kind:"receipt",receipt,...snapshot}))
            await refresh(deck,snapshot,websocket)
          }).catch(error=> { if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify({kind:"error",code:error instanceof Error ? error.message : "sync-failed"})) })
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
  return { refresh, close() { for (const socket of peers.keys()) socket.terminate(); sockets.close() } }
}
