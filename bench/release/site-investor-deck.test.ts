import {expect,it} from "vitest"
import {boundedResult} from "../../packages/tools/src/snapshots.ts"
import {investorDeck} from "./site-investor-deck.ts"

it("labels the sample revenue chart and its segment growth",()=>{
 const slide=investorDeck("sample").slides[2]!
 const labels=slide.elements.flatMap(element=>element.kind==="text"?element.runs.map(run=>run.text):[])
 expect(labels).toContain("Growth by segment")
 expect(labels).toEqual(expect.arrayContaining(["FY23","FY24","FY25E","+46%","+37%","+35%","+8%","+14%","+11%","+20%","+20% CAGR"]))
 expect(labels).toContain("Source: synthetic Halden investor update. Sample data.")
 expect(slide.notes).toContain("Sample data")
})

it("keeps the exhibit slide readable by the agent tool",()=>{
 const slide=investorDeck("sample").slides[2]!
 expect(()=>boundedResult({savedVersion:1,items:[slide],nextCursor:null})).not.toThrow()
})
