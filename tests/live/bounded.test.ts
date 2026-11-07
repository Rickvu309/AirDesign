import {expect,it} from "vitest"
import {within} from "../../scripts/live/bounded.ts"

it("returns the fallback when a failure screenshot never settles",async()=>{
  const started=Date.now()
  expect(await within(new Promise<string|null>(()=>undefined),50,null)).toBeNull()
  expect(Date.now()-started).toBeLessThan(1000)
})

it("returns the work's value when it settles first",async()=>{
  expect(await within(Promise.resolve("failure-export-pptx.png"),5000,null)).toBe("failure-export-pptx.png")
})
