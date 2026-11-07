import {describe,it,expect} from "vitest"
import {z} from "zod"
import {readdir,readFile} from "node:fs/promises"
import {parseRegistry,readRegistry,readBudgetBaseline,validateRegistry,ratchet,selectScenarios,passesParity} from "./registry.ts"
import {investorDeck} from "./investor-deck.ts"
import {fixtureIdentifier} from "./fixture-identifiers.ts"
import {surfaceTargets} from "./targets.ts"
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
  it("seeds the design narrative with eight slides and the revenue chart labels",()=>{
    const deck=investorDeck("parity"),copy=deck.slides.flatMap(slide=>slide.elements.flatMap(element=>element.kind==="text" ? element.runs.map(run=>run.text) : []))
    expect(deck.slides).toHaveLength(8)
    expect(deck.template).toEqual({id:"halden",version:1,family:"basic"})
    expect(copy).toContain("Revenue grew 39% year over year")
    expect(copy).toEqual(expect.arrayContaining(["$4.1M","$5.7M","Q3 24","Q3 25"]))
    expect(deck.slides[2]?.notes).toContain("two enterprise deals")
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
it("enforces release targets separately from regression ceilings and refuses missing coverage",async()=>{
  const entries=await readRegistry(),entry=entries.find(entry=>entry.status==="reachable")!,missing=entries.find(entry=>entry.status==="unreachable")!
  const scenario={...entry,budget:0.9,target:surfaceTargets[entry.surface]}
  expect(passesParity(scenario,0.8,false)).toBe(true)
  expect(passesParity(scenario,0.8,true)).toBe(false)
  expect(passesParity(scenario,0.02,true)).toBe(true)
  expect(passesParity({...scenario,target:1},0.8,true)).toBe(false)
  expect(passesParity(scenario,0.95,false)).toBe(false)
  expect(passesParity(missing,undefined,true)).toBe(false)
})

it("rejects target edits independently of regression budgets",async()=>{
  const entries=await readRegistry()
  for(const entry of entries){
    expect(entry.target).toBe(surfaceTargets[entry.surface])
    expect(()=>validateRegistry([{...entry,target:1}],[entry.design.split("/").at(-1)!],{[entry.code]:1})).toThrow("uncalibrated-target")
  }
})

it("binds release thresholds to the committed faithful-reference calibration",async()=>{
  const record=z.object({targets:z.object({site:z.number(),studio:z.number()}),results:z.array(z.object({surface:z.enum(["site","studio"]),reference:z.object({score:z.number()})})),editor:z.array(z.object({score:z.number()}))}).parse(JSON.parse(await readFile(new URL("./calibration.json",import.meta.url),"utf8")))
  expect(surfaceTargets).toEqual(record.targets)
  expect(record.results).toHaveLength(52)
  expect(record.editor).toHaveLength(2)
  for(const surface of ["site","studio"] as const){
    const faithful=[...record.results.filter(row=>row.surface===surface).map(row=>row.reference.score),...(surface==="studio" ? record.editor.map(row=>row.score) : [])]
    expect(record.targets[surface]).toBe((Math.ceil(Math.max(...faithful)*100)+1)/100)
  }
  for(const row of record.results)expect(row.reference.score).toBeLessThan(row.surface=== "site" ? surfaceTargets.site : surfaceTargets.studio)
  for(const row of record.editor)expect(row.score).toBeLessThan(surfaceTargets.studio)
})
