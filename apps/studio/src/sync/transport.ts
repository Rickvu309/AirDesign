import type { Receipt } from "../../../../packages/change-log/src/index.ts"
import { SyncClient, parseSnapshot, type Snapshot } from "../../../../packages/rpc/src/client.ts"
import { parseMessage } from "../../../../packages/rpc/src/wire.ts"
export async function currentPerson(): Promise<string | null> {
  const response = await fetch("/api/account")
  const value: unknown = await response.json()
  return value && typeof value === "object" && "status" in value && value.status === "signed-in" && "personId" in value && typeof value.personId === "string" ? value.personId : null
}
export function cachedSnapshot(person: string, deck: string): Snapshot | null {
  const value = localStorage.getItem(JSON.stringify(["snapshot",person,deck]))
  if (!value) return null
  try { return parseSnapshot(JSON.parse(value)) } catch { return null }
}
export function transport(client: SyncClient, person: string, deck: string, error: (value:string)=>void) {
  let socket: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let slow: ReturnType<typeof setTimeout> | undefined
  let attempts=0
  let stopped=false
  let generation=0
  let resumed=false
  let offlineAt=Date.now()
  let previous:Snapshot|undefined
  let pending:Snapshot|undefined
  let persistence:ReturnType<typeof setTimeout>|undefined
  let persistenceStarted:number|undefined
  let persistenceQueued=false
  let checkpoints:(()=>void)[]=[]
  const cache = (snapshot:Snapshot,recovering=false)=>{
    const checkpoint=new Promise<void>(resolve=>{checkpoints.push(resolve)})
    pending=snapshot
    if(persistenceQueued)return checkpoint
    persistenceStarted ??= Date.now()
    clearTimeout(persistence)
    persistence=setTimeout(()=>{
      persistenceQueued=true
      const persist=()=>{
        persistence=undefined;persistenceStarted=undefined;persistenceQueued=false
        const latest=pending;pending=undefined
        if(latest)try{
          localStorage.setItem(JSON.stringify(["snapshot",person,deck]),JSON.stringify(latest))
          const durable=checkpoints;checkpoints=[]
          for(const resolve of durable)resolve()
        }catch(failure){error(String(failure))}
      }
      if(recovering)persist()
      else if(typeof requestIdleCallback==="function")requestIdleCallback(persist,{timeout:1000})
      else void afterPaint().then(persist)
    },recovering ? 0 : Math.min(100,Math.max(0,1000-(Date.now()-persistenceStarted))))
    return checkpoint
  }
  let received=Promise.resolve()
  let recovering=false
  const afterPaint=()=>new Promise<void>(resolve=>{
    if(document.visibilityState!=="visible"){setTimeout(resolve,0);return}
    requestAnimationFrame(()=>setTimeout(resolve,0))
  })
  async function connect() {
    const own=++generation
    recovering=client.queue.length>1
    clearTimeout(timer)
    socket?.close();socket=null
    client.disconnected(Date.now()-offlineAt>=3000)
    if (!slow) slow=setTimeout(()=>{if (!stopped && !resumed) client.disconnected(true)},Math.max(0,3000-(Date.now()-offlineAt)))
    resumed=false
    try {
      const authenticated=await currentPerson()
      if (own!==generation || stopped) return
      if (authenticated!==person || !client.resume(authenticated)) { client.stop("signed-out");return }
      const initial=await fetch(`/api/decks/${deck}`)
      if (own!==generation || stopped) return
      if (initial.status===410) { client.stop("deleted");return }
      if (initial.status===401 || initial.status===404) { client.stop("signed-out");return }
      if (!initial.ok) throw new Error("sync-unavailable")
      const url=new URL("/ws",location.href)
      url.protocol=location.protocol==="https:" ? "wss:" : "ws:"
      url.searchParams.set("deck",deck);url.searchParams.set("after",String(client.seq))
      const active=new WebSocket(url)
      socket=active
      let inbox:string[]=[]
      let delivery:ReturnType<typeof setTimeout>|undefined
      active.onmessage=event=> {
        inbox.push(String(event.data))
        if(delivery!==undefined)return
        const drain=()=>{
          delivery=undefined
          const batch=inbox;inbox=[]
          received=received.then(async()=>{
            if(own!==generation || stopped)return
            try{
              const receipts:Receipt[]=[]
              let latest:Snapshot|undefined
              for(const raw of batch){
                const message=parseMessage(JSON.parse(raw),previous)
                if(message.kind==="snapshot" || message.kind==="receipt"){
                  if(message.deck.id!==deck)throw new Error("wrong-deck-snapshot")
                  if(message.seq>=Math.max(client.seq,previous?.seq ?? 0)){previous=message;latest=message}
                  if(message.kind==="receipt")receipts.push(message.receipt)
                }else if(message.kind==="signed-out"){client.stop("signed-out");active.close()}
                else if(message.kind==="error"){
                  if(message.code==="deck-deleted"){client.stop("deleted");active.close()}
                  else error(message.code)
                }
              }
              if(receipts.length)await afterPaint()
              if(own!==generation || stopped)return
              if(receipts.length && !latest)latest=previous
              if(latest){
                client.receive(latest)
                if(!resumed){resumed=true;attempts=0;clearTimeout(slow);slow=undefined;client.connected(command=>{if(active.readyState===WebSocket.OPEN)active.send(JSON.stringify(command))})}
                const checkpoint=cache(latest,recovering)
                if(receipts.length)void client.acknowledgeBatch(receipts,checkpoint).then(()=>{if(client.queue.length===0)recovering=false}).catch(failure=>error(String(failure)))
              }
              if(recovering && client.queue.length===0)recovering=false
            }catch(failure){error(String(failure));active.close()}
          }).catch(failure=>error(String(failure)))
        }
        if(resumed && recovering)delivery=setTimeout(drain,48)
        else drain()
      }
      active.onclose=()=> { if (own===generation && !stopped && client.state.kind!=="deleted" && client.state.kind!=="signed-out") { if (resumed) offlineAt=Date.now();resumed=false;retry() } }
      active.onerror=()=>active.close()
    } catch { if (own===generation && !stopped) retry() }
  }
  function retry() {
    client.disconnected(Date.now()-offlineAt>=3000)
    if (!slow) slow=setTimeout(()=>{if (!stopped && !resumed) client.disconnected(true)},Math.max(0,3000-(Date.now()-offlineAt)))
    if (attempts>=3) return
    timer=setTimeout(()=>void connect(),[500,1000,2000][attempts++] ?? 2000)
  }
  const online=()=>{if(resumed && socket?.readyState===WebSocket.OPEN)return;attempts=0;void connect()}
  const offline=()=>socket?.close()
  window.addEventListener("online",online)
  window.addEventListener("offline",offline)
  void connect()
  return {
    reconnect:online,
    close() { stopped=true;generation++;clearTimeout(timer);clearTimeout(slow);socket?.close();window.removeEventListener("online",online);window.removeEventListener("offline",offline) },
  }
}
