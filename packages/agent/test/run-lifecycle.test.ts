import {expect,it} from "vitest"
import {z} from "zod"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {runHarness,type AgentActivity,type AgentTools} from "../src/harness.ts"
import {localAdapter} from "../src/local-adapter.ts"

function sharedTools(){
  const deck=fixtureDeck(1,2),writes:unknown[]=[]
  deck.slides[1]!.notes="Presenter’s private notes"
  const call:AgentTools=async(name,input)=>{
    const args=z.object({slideId:z.string().optional()}).parse(input)
    if(name==="apply_changes")writes.push(input)
    const items=name==="get_deck" ? deck.slides.map(slide=>({id:slide.id})) : name==="get_slide" ? deck.slides.filter(slide=>slide.id===args.slideId) : []
    return {content:[{type:"text",text:JSON.stringify({ok:true,data:{savedVersion:0,items}})}]}
  }
  return {call,writes}
}

it("resumes through SDK tools without repeating completed scopes and retains request identity on replay",async()=>{
  const context={run:"aira_saved",deckId:"deck",selection:[],request:"A clearer story",completed:["s0"]},signal=new AbortController().signal
  const first=sharedTools(),events:AgentActivity[]=[]
  for await(const event of runHarness(context,first.call,signal,localAdapter))events.push(event)
  expect(events.filter(event=>event.kind==="tool"&&event.name==="apply_changes")).toMatchObject([{scope:"s1"}])
  expect(first.writes).toHaveLength(1)
  expect(first.writes[0]).toMatchObject({changes:[{target:"s1",value:{notes:"Presenter’s private notes",elements:[expect.objectContaining({runs:[expect.objectContaining({text:context.request})]})]}}]})
  const replay=sharedTools()
  for await(const event of runHarness(context,replay.call,signal,localAdapter))expect(event).toBeDefined()
  expect(replay.writes).toEqual(first.writes)
})

it("validates the complete selection before accepting any write",async()=>{
  const tools=sharedTools(),events:AgentActivity[]=[]
  const run=async()=>{for await(const event of runHarness({run:"aira_selection",deckId:"deck",selection:["s0e0","missing"],request:"Never partially apply"},tools.call,new AbortController().signal,localAdapter))events.push(event)}
  await expect(run()).rejects.toThrow("selection-not-in-deck")
  expect(tools.writes).toEqual([])
  expect(events.some(event=>event.kind==="tool"&&event.name==="get_slide")).toBe(true)
})

it("stops dispatching writes when the consumer cancels an accepted scope",async()=>{
  const tools=sharedTools(),controller=new AbortController(),scopes:string[]=[]
  for await(const event of runHarness({run:"aira_stop",deckId:"deck",selection:[],request:"Stop safely"},tools.call,controller.signal,localAdapter)){
    if(event.kind==="tool"&&event.name==="apply_changes"){scopes.push(event.scope!);controller.abort()}
  }
  expect(scopes).toEqual(["s0"])
  expect(tools.writes).toHaveLength(1)
})
