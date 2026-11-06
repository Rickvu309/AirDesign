import type { DeckEntry } from "../../../../packages/catalog/src/index.ts"

export async function api<T>(path:string,body?:unknown,method=body===undefined ? "GET" : "POST"):Promise<T> {
  const response=await fetch(path,{method,...(method==="GET" && body===undefined ? {} : {headers:{"content-type":"application/json"}}),...(body===undefined ? {} : {body:JSON.stringify(body)})})
  const value=await response.json()
  if(!response.ok)throw new Error(typeof value?.code==="string" ? value.code : "request-failed")
  return value
}
export function listDecks(trash:boolean,search:string) {return api<DeckEntry[]>(`/api/catalog?trash=${trash}&search=${encodeURIComponent(search)}`)}
export function createDeck(pendingRequest:string) {return api<DeckEntry>("/api/catalog",{requestId:crypto.randomUUID(),title:"Untitled deck",pendingRequest})}
export function deckAction(deck:string,action:"rename"|"trash"|"restore"|"duplicate"|"request",body:unknown={}) {return api<DeckEntry>(`/api/catalog/${deck}/${action}`,body)}
