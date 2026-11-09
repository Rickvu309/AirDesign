import {flatten,type Deck,type Id} from "../../../../packages/deck/src/index.ts"
import type {AgentRun} from "../../../../packages/agent/src/activity.ts"

export function runSlideStates(deck:Deck,run:AgentRun|null):Map<Id,"queued"|"working"|"complete"> {
  const states=new Map<Id,"queued"|"working"|"complete">()
  if(!run)return states
  const targets=deck.slides.filter(slide=>!run.selection.length||run.selection.includes(slide.id)||flatten(slide.elements).some(element=>run.selection.includes(element.id)))
  const completed=new Set<string>(targets.filter(slide=>run.completed.includes(slide.id)||flatten(slide.elements).some(element=>run.completed.includes(element.id))).map(slide=>slide.id))
  const reading=run.events.findLast(event=>event.kind==="tool"&&event.name==="get_slide"&&event.scope&&!completed.has(event.scope))
  const active=run.kind==="working" ? targets.find(slide=>reading?.kind==="tool"&&reading.scope===slide.id)?.id ?? targets.find(slide=>!completed.has(slide.id))?.id : undefined
  for(const slide of targets)states.set(slide.id,completed.has(slide.id) ? "complete" : slide.id===active ? "working" : "queued")
  return states
}
export function runMilestones(deck:Deck,run:AgentRun):string[] {
  const messages:string[]=[]
  const tools=run.events.filter(event=>event.kind==="tool")
  for(const event of tools)if(event.fileName&&!messages.includes(`Read ${event.fileName}`))messages.push(`Read ${event.fileName}`)
  if(tools.some(event=>event.name==="get_deck"))messages.push("Read deck content")
  if(tools.some(event=>event.name==="get_slide"))messages.push("Read slide content")
  if(tools.some(event=>event.brandApplied))messages.push("Applied brand")
  const states=runSlideStates(deck,run),completed=[...states.values()].filter(state=>state==="complete").length
  if(completed)messages.push(`Built ${completed} of ${states.size} slides`)
  const current=[...states.values()].indexOf("working")
  if(run.kind==="working"&&current>=0)messages.push(`Building slide ${current+1} of ${states.size}`)
  return messages
}
