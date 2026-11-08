import path from "node:path"
import {build} from "vite"
import {chromium,type Page} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {assertScenarioCopy,probeScenarioInteraction} from "./dom-assertions.ts"
import {readRegistry} from "./registry.ts"
let script="",styles=""
beforeAll(async()=>{
 const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts"),"@airdesign/access/client":path.resolve("packages/access/src/client/index.ts")}},build:{write:false,minify:false,lib:{entry:path.resolve("apps/studio/src/main.tsx"),formats:["iife"],name:"SettingsAuthProof"}}})
 const outputs=(Array.isArray(built)?built:[built]).flatMap(result=>"output" in result?result.output:[])
 script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
 styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css")?[typeof output.source==="string"?output.source:new TextDecoder().decode(output.source)]:[]).join("\n")
})
async function owner(page:Page){
 const menu=page.getByLabel("Account menu",{exact:true})
 expect(await menu.getByText("Ada Lovelace",{exact:true}).count()).toBe(1)
 expect(await page.getByRole("heading",{name:"Settings",exact:true}).isVisible()).toBe(true)
 expect(new URL(page.url()).pathname).toBe("/settings/usage")
}
it("keeps the authenticated Settings owner after real Sign out Cancel and rejects absent or wrong owners",async()=>{
 const entry=(await readRegistry()).find(entry=>entry.code==="S99.01");if(!entry)throw new Error("missing-S99.01")
 const browser=await chromium.launch(),requests:string[]=[]
 try{
  const page=await browser.newPage({viewport:entry.viewport});page.setDefaultTimeout(700)
  await page.route("http://settings-auth.test/**",route=>{
   const url=new URL(route.request().url());requests.push(url.pathname)
   if(url.pathname==="/api/session")return route.fulfill({json:{status:"signed-in",personId:"ada",email:"ada@halden.com",displayName:"Ada Lovelace",freeUsageWeekStartedAt:null,intentToken:null,kind:"home"}})
   if(url.pathname.startsWith("/api/"))return route.fulfill({status:503,json:{code:"unavailable"}})
   return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'})
  })
  await page.goto("http://settings-auth.test/settings/usage");await page.addStyleTag({content:styles});await page.addScriptTag({content:script})
  await page.getByRole("heading",{name:"Settings",exact:true}).waitFor();await page.getByLabel("Account menu",{exact:true}).getByText("Ada Lovelace",{exact:true}).waitFor();await owner(page)
  await expect(assertScenarioCopy(page,["shell.home"],entry.code)).rejects.toThrow("required-visible-copy")
  await assertScenarioCopy(page,entry.assertions.entryCopyKeys??[],entry.code)
  await probeScenarioInteraction(page,entry);await owner(page)
  expect(requests).not.toContain("/api/session/revoke")
  expect(await page.getByRole("dialog",{name:"Sign out?",exact:true}).isVisible()).toBe(false)
  const menu=page.getByLabel("Account menu",{exact:true}),original=await menu.innerHTML()
  await menu.evaluate(element=>element.textContent="Other account")
  await expect(owner(page)).rejects.toThrow()
  await menu.evaluate((element,html)=>element.innerHTML=html,original);await owner(page)
  await menu.evaluate(element=>element.removeAttribute("aria-label"))
  await expect(probeScenarioInteraction(page,entry)).rejects.toThrow("check=interaction")
 }finally{await browser.close()}
})
