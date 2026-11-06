import {renderSiteTerms} from "../../../scripts/site-terms.ts"
import {it,expect} from "vitest"
import {readFileSync,readdirSync} from "node:fs"
import {discoveryIntent} from "../../studio/src/access/discovery-intent.ts"
import {usageRates} from "../../../packages/usage/src/ledger.ts"
it("keeps each discovery intent at the sign-in boundary",()=>{
 for(const kind of ["new-deck","import","connect-agent"] as const) expect(discoveryIntent({pathname:"/studio",search:`?start=${kind}`})).toBe(kind)
 expect(discoveryIntent({pathname:"/studio",search:"?start=share"})).toBe("home")
})
it("publishes the shipped allowance and weighted rates",()=>{
 const html=renderSiteTerms(readFileSync("apps/site/pricing/index.html","utf8"))
 expect(html).toContain(usageRates.allowance.toLocaleString("en-US"))
 expect(html).toContain(`cost ${usageRates["user-agent"]} unit`)
 expect(html).toContain(`costs ${usageRates.aira}`)
 expect(html).toContain("Provider sandbox verification is pending")
})

it("requires a real product capture and exported package examples",()=>{
 for(const file of ["studio-capture.png","examples/before.pptx","examples/after.pptx"])expect(readFileSync(`apps/site/public/${file}`).byteLength).toBeGreaterThan(1000)
})

it("routes every public HTML page through the site build",()=>{
 expect(readdirSync("apps/site/public",{recursive:true}).filter(file=>String(file).endsWith(".html"))).toEqual([])
})

it("keeps reset prices in Settings",()=>{
 const pricing=readFileSync("apps/site/pricing/index.html","utf8")
 expect(pricing).not.toMatch(/reset consumes \$\d|reset costs \$\d/)
})
it("restores the designed discovery structure",()=>{
 const landing=readFileSync("apps/site/index.html","utf8"),pricing=readFileSync("apps/site/pricing/index.html","utf8")
 for(const feature of ["finance-chart","deck-checks","studio-demo","demo-rail","agent-diagram"])expect(landing).toContain(feature)
 expect(pricing).toContain("usage-details")
})
