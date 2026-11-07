import {chromium} from "playwright"
import {readFile} from "node:fs/promises"
import {expect,it} from "vitest"
import {assertScenarioDOM,probeScenarioInteraction} from "./dom-assertions.ts"
import {readRegistry} from "./registry.ts"
import {compareDesign} from "./metric.mjs"

it("rejects the pixel-perfect design bitmap before capture and accepts working controls",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S31.02")!
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
    await page.setContent('<p>AirDesign</p><h1>Recents</h1><button>Commands</button><button id="open">Sign out</button><main><button>Sign out</button></main><dialog aria-label="Sign out?"><button id="close">Cancel</button></dialog><script>document.querySelector("#open").onclick=()=>document.querySelector("dialog").showModal();document.querySelector("#close").onclick=()=>document.querySelector("dialog").close()</script>')
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
    await page.evaluate(()=>{const button=document.querySelector<HTMLButtonElement>("#open");if(button)button.onclick=null})
    await expect(probeScenarioInteraction(page,entry)).rejects.toThrow()
  }finally{await browser.close()}
})
