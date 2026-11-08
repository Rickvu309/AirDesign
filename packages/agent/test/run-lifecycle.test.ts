import {initialHistory, commandId} from "../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"
import {executeNative} from "../../change-log/src/text/native-model.ts"
import {parseNativeChangeSet} from "../../deck/src/text/operations.ts"
import {expect,it} from "vitest"
import {z} from "zod"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {runHarness,type AgentActivity,type AgentTools} from "../src/harness.ts"
import {localAdapter} from "../src/local-adapter.ts"

function sharedTools(deck=fixtureDeck(1,2)){
  const writes:unknown[]=[]
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
  expect(first.writes[0]).toMatchObject({changes:[{target:"s1",value:{...fixtureDeck(1,2).slides[1],notes:"Presenter’s private notes"}}]})
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

it("never copies a run request into existing slide content or notes",async()=>{
  for(const selection of [[],["s2"],["s2e0"]]){
    const deck=fixtureDeck(1,8),eyebrow=deck.slides[2]!.elements[0]!
    if(eyebrow.kind!=="text")throw new Error("missing-eyebrow")
    eyebrow.runs[0].text="REVENUE"
    const tools=sharedTools(deck),request="Make an 8-slide investor update from my notes. Calm, data first, our Halden brand."
    for await(const event of localAdapter({run:"aira_content",deckId:"deck",selection,request},tools.call,new AbortController().signal))expect(event).toBeDefined()
    expect(tools.writes.length).toBeGreaterThan(0)
    expect(JSON.stringify(tools.writes)).not.toContain(request)
    expect(JSON.stringify(tools.writes)).toContain("REVENUE")
  }
})

it("applies brand fonts to native paragraphs and insertion styles without rewriting person content", async () => {
  const legacy = fixtureDeck(1), original = legacy.slides[0]!.elements[0]!
  if (original.kind !== "text") throw new Error("text-required")
  original.runs[0].text += "\n"
  let history = transduceLegacyHistory({version: 2, history: initialHistory(legacy), immutable: {version: 2, events: [], receipts: []}}).history
  const initial = history.deck.slides[0]!.elements[0]!
  if (initial.kind !== "text") throw new Error("text-required")
  const writes: unknown[] = []
  const call: AgentTools = async (name, input) => {
    let data: unknown
    if (name === "get_brand") data = {font: "Liberation Serif"}
    else if (name === "apply_changes") {
      const args = z.object({changes: z.unknown()}).parse(input)
      const changes = parseNativeChangeSet({changes: args.changes})
      const result = executeNative(history, {id: commandId("brand-native"), kind: "edit", base: history.seq, run: null, changes})
      expect(result.receipt.kind).toBe("applied")
      history = result.history
      writes.push(input)
      data = result.receipt
    } else data = {savedVersion: history.seq, items: name === "get_deck" ? history.deck.slides.map(slide => ({id: slide.id})) : history.deck.slides, template: {id: "brand", version: 1}}
    return {content: [{type: "text", text: JSON.stringify({ok: true, data})}]}
  }
  const context = {run: "native-agent", deckId: "deck", request: "Preserve this person input", selection: [initial.id]}
  for await (const event of localAdapter(context, call, new AbortController().signal)) expect(event).toBeDefined()
  expect(writes).toHaveLength(1)
  const text = history.deck.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("text-required")
  expect(text.body.paragraphs[0].endStyle.font).toBe("Liberation Serif")
  expect(text.body.paragraphs[0].runs.map(run => run.style.font)).toEqual(["Liberation Serif", "Liberation Serif"])
  expect(text.body.frame).toEqual(initial.body.frame)
  expect(JSON.stringify(writes)).not.toContain(context.request)
})
