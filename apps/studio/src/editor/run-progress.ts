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
  const files=new Set(tools.flatMap(event=>event.fileName ? [event.fileName] : []))
  const brand=tools.some(event=>event.brandApplied)
  if(files.size)messages.push(`Read ${files.size} ${files.size===1 ? "file" : "files"}${brand ? `, applied ${deck.template?.id==="halden" ? "Halden " : ""}brand` : ""}`)
  else if(brand)messages.push("Applied brand")
  else if(tools.some(event=>event.name==="get_deck"))messages.push("Read deck content")
  const states=runSlideStates(deck,run),completed=[...states.values()].filter(state=>state==="complete").length
  if(completed)messages.push(completed===2&&[...states.values()].slice(0,2).every(state=>state==="complete") ? "Built slides 1 and 2" : `Built ${completed} of ${states.size} slides`)
  const current=[...states.values()].indexOf("working")
  if(run.kind==="working"&&current>=0&&tools.some(event=>event.name==="get_slide"))messages.push(`Building slide ${current+1} of ${states.size}`)
  return messages
}
