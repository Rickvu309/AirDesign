import {chromium} from "playwright"
import {expect,it} from "vitest"
import {assertScenarioCopy,assertScenarioOwnedCopy} from "./dom-assertions.ts"
import {readRegistry,parseRegistry} from "./registry.ts"

it("requires the reset toast and Aira panel to own their exact painted copy independently",async()=>{
 const entry=(await readRegistry()).find(entry=>entry.code==="S92.04")
 if(!entry)throw new Error("missing-reset-scenario")
 const browser=await chromium.launch()
 try{
  const page=await browser.newPage({viewport:entry.viewport})
  const baseline='<style>body{font:14px Arial;color:#222;background:white}aside,div{padding:16px}</style><div data-sonner-toast>Usage reset. You’re ready to keep going.</div><aside aria-label="Aira"><p>Pick up where you left off.</p><button>Resume</button></aside>'
  const {resolveCopy}=await import("./registry.ts")
  const html=baseline.replace('Usage reset. You’re ready to keep going.',resolveCopy("usage.reset_done"))
  await page.setContent(html)
  await expect(assertScenarioOwnedCopy(page,entry)).resolves.toBeUndefined()
  await expect(assertScenarioOwnedCopy(page,{...entry,assertions:{...entry.assertions,copyOwners:undefined}})).rejects.toThrow("required-visible-copy")
  for(const mutation of ["missing-panel","hidden-panel","outside-panel","inside-toast","wrong-toast","hidden-copy","duplicate-toast","duplicate-panel"]){
   await page.setContent(html)
   await expect(assertScenarioOwnedCopy(page,entry)).resolves.toBeUndefined()
   await page.evaluate(kind=>{
    const panel=document.querySelector("aside"),toast=document.querySelector("[data-sonner-toast]"),text=panel?.querySelector("p")
    if(!panel||!toast||!text)throw new Error("missing-owned-copy-baseline")
    if(kind==="missing-panel")panel.remove()
    if(kind==="hidden-panel")panel.hidden=true
    if(kind==="outside-panel")document.body.append(text)
    if(kind==="inside-toast")toast.append(text)
    if(kind==="wrong-toast"){document.body.append(document.createTextNode(toast.textContent??""));toast.textContent="Unrelated toast"}
    if(kind==="hidden-copy")text.style.visibility="hidden"
    if(kind==="duplicate-toast")toast.after(toast.cloneNode(true))
    if(kind==="duplicate-panel")panel.after(panel.cloneNode(true))
   },mutation)
   await expect(assertScenarioOwnedCopy(page,entry),mutation).rejects.toThrow()
  }
 }finally{await browser.close()}
})

it("rejects incomplete and unregistered copy ownership at the repository boundary",async()=>{
 const entries=await readRegistry()
 const entry=entries.find(entry=>entry.code==="S92.04")
 if(!entry)throw new Error("missing-reset-scenario")
 expect(()=>parseRegistry(entries)).not.toThrow()
 for(const copyOwners of [{"usage.reset_done":"toast"},{...entry.assertions.copyOwners,"common.done":"toast"}]){
  expect(()=>parseRegistry(entries.map(value=>value===entry?{...value,assertions:{...value.assertions,copyOwners}}:value))).toThrow("copy-owner-coverage")
 }
})

it("retains bounded candidate reasons without swallowing the painted-copy failure",async()=>{
 const browser=await chromium.launch()
 try{
  const page=await browser.newPage()
  await page.setContent('<p style="font:14px Arial;color:#222">Required copy</p>')
  await expect(assertScenarioCopy(page,["agent.resume"])).rejects.toThrow('"candidates":0')
  await page.setContent('<button style="font:14px Arial;color:#222">Resume</button>')
  await expect(assertScenarioCopy(page,["agent.resume"])).resolves.toBeUndefined()
  await page.locator("button").evaluate(element=>element.style.setProperty("-webkit-text-fill-color","transparent"))
  await expect(assertScenarioCopy(page,["agent.resume"])).rejects.toThrow('text-ink-ownership')
 }finally{await browser.close()}
})

it("requires the Actions picker to paint its real empty search placeholder",async()=>{
 const entry=(await readRegistry()).find(entry=>entry.code==="S43.07")!
 const browser=await chromium.launch()
 try{
  const page=await browser.newPage()
  const baseline='<aside aria-label="Actions picker"><input aria-label="Search actions" placeholder="Search actions" style="font:14px Arial;color:#222"></aside>'
  await page.setContent(baseline)
  await expect(assertScenarioOwnedCopy(page,entry)).resolves.toBeUndefined()
  for(const changed of [baseline.replace('Actions picker','Other'),baseline.replace('placeholder="Search actions"','placeholder="Wrong"'),baseline.replace('<input','<input hidden'),baseline.replace('<input','<input value="Search actions"')]){
   await page.setContent(changed)
   await expect(assertScenarioOwnedCopy(page,entry)).rejects.toThrow()
  }
 }finally{await browser.close()}
})
