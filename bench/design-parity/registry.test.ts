import {describe,it,expect} from "vitest"
import {readdir} from "node:fs/promises"
import {parseRegistry,readRegistry,readBudgetBaseline,validateRegistry,ratchet,selectScenarios} from "./registry.ts"
import {flatten} from "../../packages/deck/src/apply.ts"
import {contentLabel} from "../../packages/deck/src/content-labels.ts"
import {investorDeck} from "./investor-deck.ts"
import {fixtureIdentifier} from "./fixture-identifiers.ts"
import {localFixture} from "./fixture-environment.ts"
describe("design parity contract",()=>{
  it("starts local fixtures safely after Vite sets production mode and restores the caller on failure",async()=>{
    const previous=process.env.NODE_ENV
    try{
      process.env.NODE_ENV="production"
      await expect(localFixture(async()=>process.env.NODE_ENV)).resolves.toBe("test")
      expect(process.env.NODE_ENV).toBe("production")
      await expect(localFixture(async()=>{throw new Error("fixture-start-failed")})).rejects.toThrow("fixture-start-failed")
      expect(process.env.NODE_ENV).toBe("production")
    }finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous}
  })
  it("rejects malformed fixtures at the file boundary",()=>{
    expect(()=>parseRegistry([{status:"reachable",steps:[{kind:"invented"}]}])).toThrow()
  })
  it("keeps new editor states reachable with visible DOM proof",async()=>{
    const entries=await readRegistry()
    for(const code of ["S41.03","S41.04","S43.04","S43.05","S43.06","S43.07"]){
      const entry=entries.find(value=>value.code===code)
      expect(entry?.status,code).toBe("reachable")
      if(entry?.status==="reachable")expect(entry.steps.some(step=>step.kind==="assert"),code).toBe(true)
    }
    const entry=entries.find(value=>value.code==="S41.04")!
    expect(()=>parseRegistry([{...entry,status:"reachable",steps:[{kind:"paste-slides",count:0}]}])).toThrow()
  })
  it("seeds the design narrative with eight slides and the revenue chart labels",()=>{
    const deck=investorDeck("parity"),copy=deck.slides.flatMap(slide=>flatten(slide.elements).flatMap(element=>element.kind==="text" ? element.runs.map(run=>run.text) : []))
    expect(deck.slides).toHaveLength(8)
    expect(deck.template).toEqual({id:"halden",version:1,family:"basic"})
    expect(copy).toContain("Revenue grew 39% year over year")
    expect(copy).toEqual(expect.arrayContaining(["$4.1M","$5.7M","Q3 24","Q3 25"]))
    expect(deck.slides[2]?.notes).toContain("two enterprise deals")
  })
  it("keeps native revenue bars on the design baseline with proportional heights and legible thumbnail titles",()=>{
    const deck=investorDeck("parity"),elements=flatten(deck.slides[2]!.elements)
    const baseline=elements.find(element=>element.id==="s2baseline")!
    const chart=elements.find(element=>element.id==="s2chart")!
    expect(contentLabel(chart)).toBe("Bar chart")
    expect(chart.box).toEqual({x:67.2,y:160.8,width:825.6,height:322.8})
    expect(baseline.box).toEqual({x:4.8,y:292.32,width:816,height:1.2})
    expect(chart.kind==="group"&&chart.children.filter(element=>element.kind==="text")).toHaveLength(10)
    for(const [index,value] of [4.1,4.6,5,5.4,5.7].entries()){
      const bar=elements.find(element=>element.id===`s2bar${index}`)!
      expect(bar.box.height).toBe(Math.round(value/5.7*210)*1.2)
      expect(bar.box.y+bar.box.height).toBeCloseTo(baseline.box.y)
      expect(chart.kind==="group"&&chart.children.some(element=>element.id===`s2value${index}`)).toBe(true)
      expect(chart.kind==="group"&&chart.children.some(element=>element.id===`s2label${index}`)).toBe(true)
    }
    for(const index of [0,1,4,5,6,7]){
      const title=deck.slides[index]!.elements.find(element=>element.kind==="text")!
      expect(title.kind==="text"&&title.runs[0]?.size).toBe(60)
    }
  })
  it("gives visible fixture records stable, distinct UUIDs across runs and screens",()=>{
    expect(fixtureIdentifier("S91.02",0)).toBe(fixtureIdentifier("S91.02",0))
    expect(fixtureIdentifier("S91.02",0)).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/)
    expect(new Set([fixtureIdentifier("S91.02",0),fixtureIdentifier("S91.02",1),fixtureIdentifier("S91.03",0)]).size).toBe(3)
  })
  it("covers every authoritative image exactly once",async()=>{
    const entries=await readRegistry(),images=await readdir("docs/design/v0.1/screens"),baseline=await readBudgetBaseline()
    expect(()=>validateRegistry(entries,images,baseline)).not.toThrow()
    const [first,second]=entries
    expect(()=>validateRegistry(entries.map(entry=>entry===first ? {...entry,design:second!.design} : entry===second ? {...entry,design:first!.design} : entry),images,baseline)).toThrow("screen-image-mismatch")
    expect(()=>validateRegistry(entries.slice(1),images,baseline)).toThrow("screen-coverage")
    expect(()=>validateRegistry([...entries,entries[0]!],images,baseline)).toThrow("duplicate-screen")
  })
  it("rejects raising a budget without an explanation and accepts a documented exception",async()=>{
    const entry=(await readRegistry())[0]!,image=entry.design.split("/").at(-1)!,baseline={[entry.code]:0.2}
    expect(()=>validateRegistry([{...entry,budget:0.3}],[image],baseline)).toThrow("budget-raised-without-reason")
    expect(()=>validateRegistry([{...entry,budget:0.3,budgetRaisedBecause:"Reviewed design revision"}],[image],baseline)).not.toThrow()
    expect(()=>validateRegistry([{...entry,budget:0.1}],[image],baseline)).not.toThrow()
  })
  it("only lowers budgets, retaining precision at the gate boundary",()=>{
    expect(ratchet(0.4,0.23)).toBe(0.23)
    expect(ratchet(0.4,0.8)).toBe(0.4)
    expect(ratchet(0.4,0.2300001)).toBe(0.230001)
    expect(()=>ratchet(0.4,NaN)).toThrow("invalid-ratio")
  })
  it("runs exactly the requested screens and rejects typos",async()=>{
    const entries=await readRegistry()
    expect(selectScenarios(entries,"S11.01,S21.01").map(entry=>entry.code)).toEqual(["S11.01","S21.01"])
    expect(()=>selectScenarios(entries,"S00.00")).toThrow("unknown-screen")
  })
})
