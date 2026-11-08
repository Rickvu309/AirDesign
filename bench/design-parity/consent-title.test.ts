import path from "node:path"
import {build} from "vite"
import {chromium} from "playwright"
import {expect,it} from "vitest"
import {assertScenarioStructure} from "./dom-assertions.ts"
import {readRegistry} from "./registry.ts"

it("keeps compact consent titles scoped, painted and semantically owned",async()=>{
 const cwd=path.resolve(".")
 const entry=cwd+"/virtual:consent-proof"
const built=await build({plugins:[{name:"consent-proof",resolveId:source=>source===entry?entry:undefined,load:source=>source===entry?`import {createElement} from "react";import {createRoot} from "react-dom/client";import {AgentApproval} from "${cwd}/apps/studio/src/agents/agents-panel.tsx";import {createAccessClient} from "${cwd}/packages/access/src/client/index.ts";import "${cwd}/apps/studio/src/settings/settings.css";import "${cwd}/apps/studio/src/editor/workspace.css";import "${cwd}/apps/studio/src/decks/decks.css";import "${cwd}/packages/ui/src/tokens/tokens.css";createRoot(document.getElementById("root")).render(createElement(AgentApproval,{intent:"consent",client:createAccessClient("")}));`:undefined}],configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":cwd+"/packages/ui/src/index.ts","@airdesign/access/client":cwd+"/packages/access/src/client/index.ts"}},build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"ConsentPremise"}}})
const outputs=(Array.isArray(built)?built:[built]).flatMap(result=>"output" in result?result.output:[]),script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n"),styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css")?[typeof output.source==="string"?output.source:new TextDecoder().decode(output.source)]:[]).join("\n")
 const browser=await chromium.launch()
 try{for(const client of ["Claude","Codex"]){
  const page=await browser.newPage({viewport:{width:1470,height:923}}),decisions:unknown[]=[]
  await page.route("http://consent-proof.test/**",async route=>{
   const request=route.request(),url=new URL(request.url())
   if(url.pathname==="/api/session")return route.fulfill({json:{status:"signed-in",personId:"ada",email:"ada@halden.com",displayName:"Ada Lovelace",intentToken:"consent",kind:"connect-agent"}})
   if(url.pathname==="/api/agents/approval"){
    if(request.method()==="POST"){decisions.push(request.postDataJSON());return route.fulfill({json:{redirect:"https://agent.test/return"}})}
    return route.fulfill({json:{client,scope:"decks",expired:false}})
   }
   return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'})
  })
  await page.goto("http://consent-proof.test/agents/approve");await page.addStyleTag({content:styles});await page.addScriptTag({content:script})
  const title=page.locator(".agent-approval h1");await title.waitFor()
  expect(await title.textContent()).toBe(client+" wants to use AirDesign")
  expect(await title.evaluate(element=>getComputedStyle(element).fontWeight)).toBe("600")
  const entry=(await readRegistry()).find(entry=>entry.code===(client==="Claude"?"S71.01":"S71.03"));if(!entry)throw new Error("missing-consent-entry")
  await expect(assertScenarioStructure(page,entry)).resolves.toBeUndefined()
  await expect(assertScenarioStructure(page,{...entry,assertions:{...entry.assertions,structure:{...entry.assertions.structure,textRoles:[{selector:".agent-approval h1",role:"page-title",color:"ink",minimumContrast:4.5}]}}})).rejects.toThrow("text-token:page-title")
  const original=await title.getAttribute("style")
  try{for(const style of ["font-size:26px","font-weight:700","color:rgb(120,120,120)","opacity:0","display:none"]){
   await title.evaluate((element,style)=>element.setAttribute("style",style),style)
   await expect(assertScenarioStructure(page,entry)).rejects.toThrow()
   await title.evaluate((element,value)=>value===null?element.removeAttribute("style"):element.setAttribute("style",value),original)
  }}finally{await title.evaluate((element,value)=>value===null?element.removeAttribute("style"):element.setAttribute("style",value),original)}
  await title.evaluate(element=>{const outside=element.cloneNode(true);document.body.append(outside);element.remove()})
  await expect(assertScenarioStructure(page,entry)).rejects.toThrow("required-text-role")
  await page.reload();await page.addStyleTag({content:styles});await page.addScriptTag({content:script})
  await page.getByRole("button",{name:client==="Claude"?"Allow":"Cancel",exact:true}).click()
  await page.getByRole("heading",{name:client==="Claude"?"Connected":"Connection cancelled",exact:true}).waitFor()
  expect(decisions).toEqual([{intent:"consent",allow:client==="Claude"}])
  expect(await page.getByRole("link",{name:"Return to "+client,exact:true}).getAttribute("href")).toBe("https://agent.test/return")
  if(client==="Claude"){const connected=(await readRegistry()).find(entry=>entry.code==="S71.02");if(!connected)throw new Error("missing-connected-entry");await expect(assertScenarioStructure(page,connected)).resolves.toBeUndefined()}
  await page.close()
 }}finally{await browser.close()}
})
