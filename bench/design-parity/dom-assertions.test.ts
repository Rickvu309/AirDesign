import {chromium} from "playwright"
import {readFile} from "node:fs/promises"
import {expect,it} from "vitest"
import {assertScenarioDOM,probeScenarioInteraction} from "./dom-assertions.ts"
import {readRegistry} from "./registry.ts"
import {compareDesign} from "./metric.mjs"

it("opens sign-out through the account menu and restores the closed sidebar state",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage()
    page.setDefaultTimeout(500)
    await page.setContent('<p role="status">Signed in</p><details><summary aria-label="Account menu">Ada Lovelace</summary><button id="sign-out">Sign out</button></details><dialog aria-label="Sign out?"><button id="confirm">Sign out</button><button id="cancel">Cancel</button></dialog><script>document.querySelector("#sign-out").onclick=()=>{document.querySelector("details").open=false;document.querySelector("dialog").showModal()};document.querySelector("#confirm").onclick=()=>document.querySelector("[role=status]").textContent="Signed out";document.querySelector("#cancel").onclick=()=>document.querySelector("dialog").close()</script>')
    await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
    expect(await page.locator("details").evaluate(element=>element instanceof HTMLDetailsElement&&element.open)).toBe(false)
    expect(await page.getByRole("dialog").count()).toBe(0)
    expect(await page.getByRole("status").textContent()).toBe("Signed in")
    await page.locator("#cancel").evaluate(element=>element.addEventListener("click",()=>{document.querySelector("details")!.open=true}))
    await expect(probeScenarioInteraction(page,entry)).rejects.toThrow("account-menu-probe-restore-failed")
    await page.locator("details").evaluate(element=>{if(element instanceof HTMLDetailsElement)element.open=false})
    await page.locator("#sign-out").evaluate(element=>element.remove())
    await expect(probeScenarioInteraction(page,entry)).rejects.toThrow("check=interaction")
  }finally{await browser.close()}
})

it("rejects the pixel-perfect design bitmap before capture and accepts working controls",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry={...original,assertions:{...original.assertions,structure:{icons:[],textRoles:[{selector:"h1",role:"page-title",color:"ink",minimumContrast:4.5}]}}} satisfies typeof original
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    page.setDefaultTimeout(500)
    const design=await readFile(entry.design)
    await page.setContent(`<style>body{margin:0}</style><img src="data:image/png;base64,${design.toString("base64")}">`)
    expect((await compareDesign(design,await page.screenshot())).score).toBe(0)
    await expect(assertScenarioDOM(page,entry)).rejects.toThrow("required-visible-copy")
    await expect(probeScenarioInteraction(page,entry)).rejects.toThrow()
    await page.setContent('<label>Email<input value="original"></label><button id="previous">Previous</button>')
    const fillEntry={...entry,assertions:{...entry.assertions,probe:{kind:"fill" as const,label:"Email",value:"probe@example.test"}}}
    await probeScenarioInteraction(page,fillEntry)
    expect(await page.getByLabel("Email").inputValue()).toBe("original")
    expect(await page.getByLabel("Email").evaluate(element=>element===document.activeElement)).toBe(false)
    await page.getByRole("button",{name:"Previous"}).focus()
    await probeScenarioInteraction(page,fillEntry)
    expect(await page.getByRole("button",{name:"Previous"}).evaluate(element=>element===document.activeElement)).toBe(true)
    await page.setContent('<style>h1{font:600 26px Geist;color:#222}</style><p>AirDesign</p><h1>Recents</h1><button>Commands</button><button id="open">Sign out</button><main><button>Sign out</button></main><dialog aria-label="Sign out?"><button id="close">Cancel</button></dialog><script>document.querySelector("#open").onclick=()=>document.querySelector("dialog").showModal();document.querySelector("#close").onclick=()=>document.querySelector("dialog").close()</script>')
    const working=await page.content()
    await page.setContent(`<img style="position:fixed;inset:0" src="data:image/png;base64,${design.toString("base64")}"><section style="opacity:0">${working}</section>`)
    await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
    expect((await compareDesign(design,await page.screenshot())).score).toBe(0)
    await expect(assertScenarioDOM(page,entry)).rejects.toThrow("required-visible-copy")
    await page.setContent(working)
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
    await page.evaluate(()=>{const button=document.querySelector<HTMLButtonElement>("#open");if(button)button.onclick=null})
    await expect(probeScenarioInteraction(page,entry)).rejects.toThrow()
  }finally{await browser.close()}
})

it("restores the expired link after probing the designed sign-in heading",async()=>{
 const entry=(await readRegistry()).find(entry=>entry.code==="S29.01")!
 const browser=await chromium.launch({headless:true})
 try{
  const page=await browser.newPage();page.setDefaultTimeout(500)
  await page.route("http://expired.test/",route=>route.fulfill({contentType:"text/html",body:`<h1>This link has expired</h1><button onclick="document.querySelector('h1').textContent='Sign in or create an account'">Send a new link</button>`}))
  await page.goto("http://expired.test/")
  await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
  expect(await page.getByRole("heading").textContent()).toBe("This link has expired")
 }finally{await browser.close()}
})

it("enforces the generator error title without weakening ordinary page titles",async()=>{
 const original=(await readRegistry()).find(entry=>entry.code==="S29.01")!
 const entry={...original,assertions:{...original.assertions,copyKeys:[],controls:[],structure:{icons:[],textRoles:original.assertions.structure.textRoles}}}
 const browser=await chromium.launch({headless:true})
 try{
  const page=await browser.newPage({viewport:entry.viewport})
  await page.setContent('<style>h1{font:500 15px Geist;color:#222}</style><h1>This link has expired</h1>')
  const prior={...entry,assertions:{...entry.assertions,structure:{icons:[],textRoles:[{selector:"h1",role:"page-title" as const,color:"ink" as const,minimumContrast:4.5}]}}}
  await expect(assertScenarioDOM(page,prior)).rejects.toThrow("text-token:page-title")
  await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
  await page.locator("h1").evaluate(element=>element.style.font="600 26px Geist")
  await expect(assertScenarioDOM(page,entry)).rejects.toThrow("text-token:access-error-title")
  await expect(assertScenarioDOM(page,prior)).resolves.toBeUndefined()
 }finally{await browser.close()}
})
