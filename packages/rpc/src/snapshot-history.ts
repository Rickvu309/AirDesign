import { commandId, type Contribution, type History, type Json, type Node, type Patch, type RunState } from "../../change-log/src/index.ts"
import { isId, parseDeck, type Deck } from "../../deck/src/index.ts"

function record(value:unknown):value is Record<string,unknown> { return !!value && typeof value==="object" && !Array.isArray(value) }
function integer(value:unknown):value is number { return typeof value==="number" && Number.isSafeInteger(value) && value>=0 }
function json(value:unknown):value is Json {
  return value===null || typeof value==="string" || typeof value==="boolean" || (typeof value==="number" && Number.isFinite(value)) || (Array.isArray(value) ? value.every(json) : record(value) && Object.values(value).every(json))
}
function node(value:unknown):Node | null {
  if(value===null)return null
  if(!record(value) || !isId(value.id) || !(value.parent===null || isId(value.parent)) || !integer(value.order) || !record(value.fields) || !Object.values(value.fields).every(json))throw new Error("invalid-history-node")
  const fields:Node["fields"]={}
  for(const [key,field] of Object.entries(value.fields)) { if(!json(field))throw new Error("invalid-history-field");fields[key]=field }
  return {id:value.id,parent:value.parent,order:value.order,fields}
}
function patch(value:unknown):Patch {
  if(!record(value) || !isId(value.id) || !Array.isArray(value.keys) || !value.keys.every((key:unknown)=>typeof key==="string") || typeof value.adopts!=="boolean" || typeof value.places!=="boolean")throw new Error("invalid-history-patch")
  return {id:value.id,keys:value.keys,before:node(value.before),after:node(value.after),adopts:value.adopts,places:value.places}
}
function contribution(value:unknown):Contribution {
  if(!record(value) || typeof value.id!=="string" || !integer(value.seq) || !(value.actor==="person" || value.actor==="agent") || !(value.run===null || typeof value.run==="string") || !Array.isArray(value.patches) || typeof value.active!=="boolean" || !integer(value.toggledAt))throw new Error("invalid-history-contribution")
  return {id:commandId(value.id),seq:value.seq,actor:value.actor,run:value.run,patches:value.patches.map(patch),active:value.active,toggledAt:value.toggledAt}
}
function run(value:unknown):RunState {
  if(!record(value) || typeof value.id!=="string" || !integer(value.epoch) || !(value.kind==="open" || value.kind==="closed" || value.kind==="undone"))throw new Error("invalid-history-run")
  return {id:value.id,epoch:value.epoch,kind:value.kind}
}
export function parseContributions(value:unknown,deck:Deck,seq:number) {
  if(!record(value) || !record(value.history) || !Array.isArray(value.applied))throw new Error("invalid-snapshot-history")
  const raw=value.history
  if(!integer(raw.seq) || raw.seq!==seq || !Array.isArray(raw.events) || !Array.isArray(raw.runs) || !Array.isArray(raw.usedIds) || !raw.usedIds.every(isId))throw new Error("invalid-snapshot-history")
  const history:History={initial:parseDeck(raw.initial),deck:parseDeck(raw.deck),seq:raw.seq,events:raw.events.map(contribution),runs:raw.runs.map(run),usedIds:raw.usedIds}
  const applied=value.applied.map((id:unknown)=> {if(typeof id!=="string")throw new Error("invalid-snapshot-receipt");return commandId(id)})
  if(history.initial.id!==deck.id || JSON.stringify(history.deck)!==JSON.stringify(deck) || history.events.some(event=>event.seq>seq || event.toggledAt>seq) || new Set(history.events.map(event=>event.id)).size!==history.events.length)throw new Error("inconsistent-snapshot-history")
  return {history,applied}
}
