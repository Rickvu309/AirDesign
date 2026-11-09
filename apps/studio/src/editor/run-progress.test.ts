import {expect,it} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import type {AgentRun} from "../../../../packages/agent/src/activity.ts"
import {runMilestones,runSlideStates} from "./run-progress.ts"
it("shows actual completed, working and queued targets independently of editor selection",()=>{
 const deck=fixtureDeck(1,8),run:AgentRun={id:"run",owner:"owner",deck:deck.id,request:"Build",selection:[],kind:"working",events:[{id:1,kind:"tool",name:"get_deck"},{id:2,kind:"tool",name:"get_slide"}],completed:deck.slides.slice(0,3).map(slide=>slide.id)}
 expect([...runSlideStates(deck,run).values()]).toEqual(["complete","complete","complete","working","queued","queued","queued","queued"])
 expect(runMilestones(deck,run)).toContain("Building slide 4 of 8")
 expect(runMilestones(deck,run).join(" ")).not.toContain("get_slide")
 run.selection=[deck.slides[5]!.id];run.completed=[]
 expect(runSlideStates(deck,run).get(deck.slides[5]!.id)).toBe("working")
 expect(runSlideStates(deck,run).has(deck.slides[0]!.id)).toBe(false)
})

it("follows the actual read target when slides are processed out of order",()=>{
 const deck=fixtureDeck(1,8),run:AgentRun={id:"run",owner:"owner",deck:deck.id,request:"Build",selection:[],kind:"working",events:[{id:1,kind:"tool",name:"get_slide",scope:deck.slides[5]!.id}],completed:[deck.slides[0]!.id]}
 expect(runSlideStates(deck,run).get(deck.slides[5]!.id)).toBe("working")
 expect(runSlideStates(deck,run).get(deck.slides[1]!.id)).toBe("queued")
 expect(runMilestones(deck,run)).toContain("Building slide 6 of 8")
})

it("only reports file and brand milestones carried by successful run events",()=>{
 const deck=fixtureDeck(1),run:AgentRun={id:"run",owner:"owner",deck:deck.id,request:"Build",selection:[],kind:"working",events:[],completed:[]}
 expect(runMilestones(deck,run)).not.toContain("Applied brand")
 run.events=[{id:1,kind:"tool",name:"read_file",fileName:"Q3 earnings.xlsx"},{id:2,kind:"tool",name:"get_brand"},{id:3,kind:"tool",name:"apply_changes",brandApplied:true}]
 expect(runMilestones(deck,run)).toContain("Read Q3 earnings.xlsx")
 expect(runMilestones(deck,run)).toContain("Applied brand")
 expect(runMilestones(deck,{...run,events:run.events.slice(0,2)})).not.toContain("Applied brand")
})
