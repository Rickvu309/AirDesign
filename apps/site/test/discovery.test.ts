import {it,expect} from "vitest"
import {readFileSync} from "node:fs"
import {discoveryIntent} from "../../studio/src/access/discovery-intent.ts"
import {usageRates} from "../../../packages/usage/src/ledger.ts"
it("keeps each discovery intent at the sign-in boundary",()=>{
 for(const kind of ["new-deck","import","connect-agent"] as const) expect(discoveryIntent({pathname:"/studio",search:`?start=${kind}`})).toBe(kind)
 expect(discoveryIntent({pathname:"/studio",search:"?start=share"})).toBe("home")
})
it("publishes the shipped allowance and weighted rates",()=>{
 const html=readFileSync("apps/site/pricing/index.html","utf8")
 expect(html).toContain(usageRates.allowance.toLocaleString("en-US"))
 expect(html).toContain(`cost ${usageRates["user-agent"]} unit`)
 expect(html).toContain(`costs ${usageRates.aira}`)
 expect(html).toContain("Provider sandbox verification is pending")
})

it("requires a real product capture and exported package examples",()=>{
 for(const file of ["studio-capture.png","examples/before.pptx","examples/after.pptx"])expect(readFileSync(`apps/site/public/${file}`).byteLength).toBeGreaterThan(1000)
})
