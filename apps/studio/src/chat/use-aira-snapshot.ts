import {useEffect,useState} from "react"
import type {AiraSnapshot} from "./aira-client.ts"

export function useAiraSnapshot(deck:string,enabled=true) {
  const [snapshot,setSnapshot]=useState<AiraSnapshot|null>(null),[error,setError]=useState("")
  useEffect(()=>{
    if(!enabled)return
    const events=new EventSource(`/api/aira/events?deck=${encodeURIComponent(deck)}`)
    events.onmessage=event=>{const value=JSON.parse(event.data);if(value.code)setError("This deck is unavailable. Your changes are saved.");else{setSnapshot(value);setError("")}}
    events.onerror=()=>setError("Connection interrupted. Reconnecting to your saved run…")
    return ()=>events.close()
  },[deck,enabled])
  return {snapshot,error}
}
