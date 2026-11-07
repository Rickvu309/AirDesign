import {createHash} from "node:crypto"
import {Window} from "happy-dom"
import {renderSiteTerms} from "../../../scripts/site-terms.ts"
import {it,expect} from "vitest"
import {readFileSync,readdirSync} from "node:fs"
import {discoveryIntent} from "../../studio/src/access/discovery-intent.ts"
import {usageRates} from "../../../packages/usage/src/ledger.ts"
import {releaseClaimHits,type PublicClaim} from "../../../packages/lint/src/release-claims.ts"
function parseSiteHtml(html:string){const document=new Window().document;document.write(html);return document}
it("registers public copy independently of decorative icons",()=>{
 const registry:{claims:PublicClaim[]}=JSON.parse(renderSiteTerms(readFileSync("apps/site/content/claims.json","utf8")))
 for(const page of ["index.html","pricing/index.html","status/index.html"]){
  expect(releaseClaimHits(renderSiteTerms(readFileSync(`apps/site/${page}`,"utf8")),registry.claims,readFileSync("docs/release/capabilities.md","utf8"))).toEqual([])
 }
})
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
it("preserves the landing chart, real capture and agent diagram",()=>{
 const landing=readFileSync("apps/site/index.html","utf8"),pricing=readFileSync("apps/site/pricing/index.html","utf8")
 for(const feature of ["finance-chart","deck-checks","studio-demo","agent-diagram"])expect(landing).toContain(feature)
 expect(pricing).toContain("usage-details")
})
it("restores accepted X03 copy while identifying the illustrative build state",()=>{
 const registry=JSON.parse(readFileSync("apps/site/content/claims.json","utf8"))
 expect(registry.blocked).not.toContain("X03")
 expect(parseSiteHtml(readFileSync("apps/site/status/index.html","utf8")).querySelector("article")?.textContent).not.toContain("paid models")
 const landing=parseSiteHtml(readFileSync("apps/site/index.html","utf8"))
 expect(landing.querySelector("#product .lead")?.textContent).toBe("Drop in your notes. Watch the deck build itself.")
 expect(landing.querySelector(".capture-callout")?.textContent?.trim()).toBe("Building slide 3 of 8. Coffee optional.")
 expect(landing.querySelector("#capture-description")?.textContent).toContain("Illustrative build state")
 for(const file of ["index.html","pricing/index.html"]){
  const document=parseSiteHtml(readFileSync(`apps/site/${file}`,"utf8"))
  expect([...document.querySelectorAll(".price li")].map(row=>row.textContent?.trim())).toContain("Aira built in")
 }
})
it("serves a focused mobile capture from the same eight-slide Studio run",()=>{
 const document=parseSiteHtml(readFileSync("apps/site/index.html","utf8"))
 expect(document.querySelector("#product picture source")?.getAttribute("srcset")).toBe("/studio-capture-mobile.png")
 expect(document.querySelector("#product picture source")?.getAttribute("media")).toBe("(max-width: 899.98px)")
 expect(document.querySelector(".demo-rail")).toBeNull()
 expect(document.querySelector(".capture-note a")?.getAttribute("href")).toBe("/studio-capture.json")
 const provenance=JSON.parse(readFileSync("apps/site/public/studio-capture.json","utf8"))
 expect(provenance).toMatchObject({kind:"actual-built-studio",adapter:"deterministic-local",template:"Halden",slides:8,acceptedChanges:3,viewport:{deviceScaleFactor:2}})
 expect(provenance.sha256).toBe(createHash("sha256").update(readFileSync("apps/site/public/studio-capture.png")).digest("hex"))
 expect(provenance.fixtureSha256).toBe(createHash("sha256").update(readFileSync("bench/release/site-investor-deck.ts")).digest("hex"))
})

it("leads pricing with the free plan and keeps accounting behind a disclosure",()=>{
 const html=renderSiteTerms(readFileSync("apps/site/pricing/index.html","utf8"))
 const document=parseSiteHtml(html)
 expect(document.querySelector("h1")?.textContent).toBe("AirDesign is free")
 expect(document.querySelector(".price .amount")?.textContent).toBe("$0")
 expect(document.querySelector(".price")?.textContent).not.toContain("weighted usage units")
 expect(document.querySelector("details.usage-details")?.hasAttribute("open")).toBe(false)
 expect(document.querySelector("details.usage-details")?.textContent).toContain(usageRates.allowance.toLocaleString("en-US"))
})
it("shows build identity without inferring deployment status",async()=>{
 const {createServer}=await import("vite")
 const server=await createServer({configFile:"apps/site/vite.config.ts",server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]}})
 try{
  const html=await server.transformIndexHtml("/status/",readFileSync("apps/site/status/index.html","utf8"))
  expect(html).not.toContain("not been deployed")
  expect(html).not.toContain("%SITE_BUILD_ID%")
  const document=parseSiteHtml(html)
  expect(document.querySelector("input[readonly]")?.getAttribute("value")).toMatch(/^[a-f0-9]{40}$/)
 }finally{await server.close()}
})

it("presents the designed product story and segmented navigation",()=>{
 const document=parseSiteHtml(readFileSync("apps/site/index.html","utf8"))
 expect(document.querySelector("h1")?.textContent).toBe("Clarity is the edge.")
 expect([...document.querySelectorAll(".nav-segments a")].map(link=>link.textContent)).toEqual(["Product","Agents","Pricing"])
 expect([...document.querySelectorAll("h2")].map(heading=>heading.textContent)).toEqual(["Make slides like magic.","Bring any agent.","AirDesign is free."])
 expect(document.querySelector("#product img")?.getAttribute("src")).toBe("/studio-capture.png")
})
