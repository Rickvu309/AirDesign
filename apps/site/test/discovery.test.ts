import {createHash} from "node:crypto"
import {Window} from "happy-dom"
import {renderSiteTerms} from "../../../scripts/site-terms.ts"
import {it,expect} from "vitest"
import {readFileSync,readdirSync} from "node:fs"
import {discoveryIntent} from "../../studio/src/access/discovery-intent.ts"
import {releaseClaimHits,type PublicClaim} from "../../../packages/lint/src/release-claims.ts"
function parseSiteHtml(html:string){const document=new Window().document;document.write(html);return document}
it("registers public copy independently of decorative icons",()=>{
 const registry:{claims:PublicClaim[]}=JSON.parse(renderSiteTerms(readFileSync("apps/site/content/claims.json","utf8")))
 for(const page of ["index.html","pricing/index.html","status/index.html"]){
  expect(releaseClaimHits(renderSiteTerms(readFileSync(`apps/site/${page}`,"utf8")),registry.claims,readFileSync("docs/release/capabilities.md","utf8"),`apps/site/${page}`)).toEqual([])
 }
})
it("keeps each discovery intent at the sign-in boundary",()=>{
 for(const kind of ["new-deck","import","connect-agent"] as const) expect(discoveryIntent({pathname:"/studio",search:`?start=${kind}`})).toBe(kind)
 expect(discoveryIntent({pathname:"/studio",search:"?start=share"})).toBe("home")
})
it("scopes operator design claims to the approved pages",()=>{
 const registry:{claims:PublicClaim[]}=JSON.parse(renderSiteTerms(readFileSync("apps/site/content/claims.json","utf8")))
 for(const page of ["apps/site/index.html","apps/site/pricing/index.html"])expect(releaseClaimHits("Unlimited decks",registry.claims,"",page)).toEqual([])
 for(const page of ["apps/site/status/index.html","apps/studio/index.html",""])expect(releaseClaimHits("Unlimited decks",registry.claims,"",page)).toContain("unregistered-public-copy:Unlimited decks")
})

it("requires a real product capture and exported package examples",()=>{
 for(const file of ["studio-capture.png","examples/before.pptx","examples/after.pptx"])expect(readFileSync(`apps/site/public/${file}`).byteLength).toBeGreaterThan(1000)
})

it("tints mobile browser chrome to the white site surface in both color schemes",()=>{
 for(const page of ["index.html","pricing/index.html","agents/index.html","agents/claude/index.html","agents/codex/index.html","examples/index.html","status/index.html"]){
  const themes=[...parseSiteHtml(readFileSync(`apps/site/${page}`,"utf8")).querySelectorAll('meta[name="theme-color"]')].map(meta=>[meta.getAttribute("media"),meta.getAttribute("content")])
  expect(themes,page).toEqual([["(prefers-color-scheme: light)","#ffffff"],["(prefers-color-scheme: dark)","#ffffff"]])
 }
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
 expect(pricing).not.toContain("usage-details")
})
it("restores accepted X03 copy and the designed landing text",()=>{
 const registry=JSON.parse(readFileSync("apps/site/content/claims.json","utf8"))
 expect(registry.blocked).not.toContain("X03")
 expect(parseSiteHtml(readFileSync("apps/site/status/index.html","utf8")).querySelector("article")?.textContent).not.toContain("paid models")
 const landing=parseSiteHtml(readFileSync("apps/site/index.html","utf8"))
 expect(landing.querySelector("#product .lead")?.textContent).toBe("Drop in your notes. Watch the deck build itself.")
 expect(landing.querySelector(".capture-callout")?.textContent?.trim()).toBe("Building slide 3 of 8. Coffee optional.")
 expect(landing.querySelector("#capture-description")).toBeNull()
 for(const file of ["index.html","pricing/index.html"]){
  const document=parseSiteHtml(readFileSync(`apps/site/${file}`,"utf8"))
  expect([...document.querySelectorAll(".price li")].map(row=>row.textContent?.trim())).toContain("Aira built in")
 }
})
it("retains actual capture provenance while serving the designed exhibit",()=>{
 const document=parseSiteHtml(readFileSync("apps/site/index.html","utf8"))
 expect(document.querySelector("#product picture source")?.getAttribute("srcset")).toBe("/design-product-exhibit.png")
 expect(document.querySelector("#product picture source")?.getAttribute("media")).toBe("(max-width: 899.98px)")
 expect(document.querySelector(".demo-rail")).toBeNull()
 expect(document.querySelector(".capture-note")).toBeNull()
 const provenance=JSON.parse(readFileSync("apps/site/public/studio-capture.json","utf8"))
 expect(provenance).toMatchObject({kind:"actual-built-studio",adapter:"deterministic-local",template:"Halden",slides:8,acceptedChanges:3,viewport:{deviceScaleFactor:2}})
 expect(provenance.sha256).toBe(createHash("sha256").update(readFileSync("apps/site/public/studio-capture.png")).digest("hex"))
 expect(provenance.fixtureSha256).toBe(createHash("sha256").update(readFileSync("bench/release/site-investor-deck.ts")).digest("hex"))
})

it("records the design exhibit sources and output",()=>{
 const provenance=JSON.parse(readFileSync("apps/site/public/design-product-exhibit.json","utf8"))
 expect(provenance).toMatchObject({kind:"design-source-composite",editor:"ed1.jsx",overlay:"ed54.jsx",sourceSize:[1470,923],outputSize:[1248,784]})
 const digest=(file:string)=>createHash("sha256").update(readFileSync(file)).digest("hex")
 expect(provenance.generatorSha256).toBe(digest("docs/design/v0.1/source/gen-editor.mjs"))
 expect(provenance.postprocessorSha256).toBe(digest("docs/design/v0.1/source/landing-post.sh"))
 expect(provenance.copySha256).toBe(digest("docs/design/v0.1/copy-kit.json"))
 expect(provenance.sha256).toBe(digest("apps/site/public/design-product-exhibit.png"))
})

it("matches the approved pricing copy on both pages",()=>{
 for(const file of ["index.html","pricing/index.html"]){
  const document=parseSiteHtml(renderSiteTerms(readFileSync(`apps/site/${file}`,"utf8")))
  expect(document.querySelector(".price .amount")?.textContent).toBe("$0")
  expect(document.querySelector(".price small")?.textContent).toBe("forever")
  expect([...document.querySelectorAll(".price li")].map(row=>row.textContent?.trim())).toEqual(["Unlimited decks","Aira built in","Bring Claude or Codex","PowerPoint import and export","Usage resets every week"])
  expect(document.querySelector(".reset-note")?.textContent).toBe("Don't want to wait for the weekly reset? You can pay to reset.")
 }
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
 expect(document.querySelector("#product img")?.getAttribute("src")).toBe("/design-product-exhibit.png")
})

it("rewrites only Studio route boundaries in built HTML",async()=>{
 const {build}=await import("vite")
 const routes=["/studio","/studio/","/studio/decks","/studio?start=new-deck","/studio#deck"]
 const fixtures=[...routes,"/studio-capture.json","/studio-capture.png","/studio-capture-mobile.png","/studios"]
 const result=await build({root:"apps/site",configFile:"apps/site/vite.config.ts",logLevel:"silent",plugins:[{name:"route-boundary-fixture",transformIndexHtml:{order:"pre",handler:html=>html.replace("</body>",`${fixtures.map(href=>`<a data-route-fixture href="${href}">Route</a>`).join("")}</body>`)}}],build:{write:false}})
 const bundles=Array.isArray(result)?result:[result]
 const output=bundles.flatMap(bundle=>"output" in bundle?bundle.output:[])
 const landing=output.find(asset=>asset.fileName==="index.html")
 if(!landing||landing.type!=="asset")throw new Error("Built landing HTML is missing")
 const document=parseSiteHtml(String(landing.source))
 const origin=process.env.AIRDESIGN_STUDIO_ORIGIN??"https://studio.airdesign.app"
 expect([...document.querySelectorAll("[data-route-fixture]")].map(link=>link.getAttribute("href"))).toEqual(fixtures.map(href=>routes.includes(href)?origin+href:href))
 expect(document.querySelector(".capture-note")).toBeNull()
})
