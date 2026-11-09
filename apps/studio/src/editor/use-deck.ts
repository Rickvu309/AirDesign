import { useEffect,useRef,useState } from "react"
import { SyncClient,parseSnapshot } from "../../../../packages/rpc/src/client.ts"
import { indexedOutbox } from "../../../../packages/rpc/src/outbox.ts"
import { cachedSnapshot,currentPerson,transport } from "../sync/transport.ts"
import { api } from "../decks/catalog-client.ts"
import type { DeckEntry } from "../../../../packages/catalog/src/index.ts"

export function useDeck(deckId:string) {
  const client=useRef<SyncClient|null>(null),connection=useRef<ReturnType<typeof transport>|null>(null)
  const [,render]=useState(0),[entry,setEntry]=useState<DeckEntry|null>(null),[error,setError]=useState("")
  useEffect(()=>{
    let stopped=false,frame:number|undefined,task:ReturnType<typeof setTimeout>|undefined
    function refresh() {
      if(stopped || frame!==undefined || task!==undefined)return
      frame=requestAnimationFrame(()=>{frame=undefined;task=setTimeout(()=>{task=undefined;if(!stopped)render(value=>value+1)},0)})
    }
    async function open() {
      try {
        let person:string|null
        try{person=await currentPerson();if(person)sessionStorage.setItem("editing-person",person)}catch{person=sessionStorage.getItem("editing-person")}
        if(!person)throw new Error("Sign in to open your deck.")
        let snapshot=cachedSnapshot(person,deckId),deleted=false
        try {
          const response=await fetch(`/api/decks/${deckId}`)
          if(response.status===410) {snapshot=parseSnapshot(await api(`/api/catalog/${deckId}/view`));deleted=true}
          else {if(!response.ok)throw new Error(response.status===404 ? "This deck is no longer available. Return to Home." : "Could not open this deck.");snapshot=parseSnapshot(await response.json())}
          localStorage.setItem(JSON.stringify(["snapshot",person,deckId]),JSON.stringify(snapshot))
        }catch(failure){if(navigator.onLine || !snapshot)throw failure}
        if(!snapshot)throw new Error("No saved copy is available on this device.")
        const sync=new SyncClient(person,snapshot,indexedOutbox(),refresh)
        await sync.load()
        if(stopped)return
        client.current=sync
        if(deleted)sync.stop("deleted")
        else connection.current=transport(sync,person,deckId,setError)
        render(value=>value+1)
        setEntry(await api<DeckEntry>(`/api/catalog/${deckId}`))
      }catch(failure){if(!stopped)setError(failure instanceof Error ? failure.message : "Could not open this deck.")}
    }
    void open()
    return ()=>{stopped=true;if(frame!==undefined)cancelAnimationFrame(frame);if(task!==undefined)clearTimeout(task);connection.current?.close()}
  },[deckId])
  return {sync:client.current,entry,setEntry,error,setError,reconnect:()=>connection.current?.reconnect()}
}
