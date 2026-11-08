import {readFile} from "node:fs/promises"
import {chromium} from "playwright"
import {expect,it} from "vitest"
import {assertScenarioStructure,assertScenarioOwnedCopy,waitForScenarioDialog} from "./dom-assertions.ts"
import {readRegistry,resolveCopy} from "./registry.ts"

it("keeps the traced deck title in grid, single and compact layouts and rejects the old reset",async()=>{
  const css=await readFile("apps/studio/src/editor/editor.css","utf8"),entry=(await readRegistry()).find(entry=>entry.code==="S42.01")!
  const browser=await chromium.launch()
  try{
    const page=await browser.newPage()
    const titleEntry={...entry,component:undefined,assertions:{...entry.assertions,structure:{icons:[],textRoles:entry.assertions.structure.textRoles}}}
    for(const width of [1470,1024,390])for(const view of ["grid","single"]){
      await page.setViewportSize({width,height:923})
      await page.setContent(`<style>:root{--font-sans:Geist;--foreground:#222;--card:white;--border:#ddd;--muted:white}body{font:14px Geist;background:white}${css}</style><div class="studio-editor" data-view="${view}"><header class="editor-bar"><div class="deck-menu"><button class="deck-name">Q3 Investor Update</button></div></header></div>`)
      await expect(assertScenarioStructure(page,titleEntry)).resolves.toBeUndefined()
      await page.addStyleTag({content:'.studio-editor .editor-bar .deck-name{font-size:12px;font-weight:400}'})
      await expect(assertScenarioStructure(page,titleEntry)).rejects.toThrow(/text-token:module-title/)
    }
  }finally{await browser.close()}
})

it("keeps editor status and Sonner feedback below the history controls and rejects original overlap",async()=>{
  const css=await readFile("apps/studio/src/editor/editor.css","utf8"),browser=await chromium.launch()
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923}})
    for(const kind of ["offline","toast"]){
      await page.setContent(`<style>:root{--foreground:#222;--primary-foreground:white;--card:white;--muted:white}.ad-toaster{position:fixed;top:12px;left:535px;width:400px;height:40px;background:#222;z-index:100}${css}</style><div class="ad-editor-shell"><div class="studio-editor" data-view="single" data-chat="true" data-sync-state="${kind==='offline'?'offline':'saved'}"><button id="history" style="position:fixed;left:751px;top:14px;width:28px;height:28px">Undo</button>${kind==='offline'?'<p class="editor-status" role="status">You’re offline. Edits are saved on this device.</p>':''}</div>${kind==='toast'?'<ol class="ad-toaster" data-sonner-toaster data-y-position="top">Usage reset. You’re ready to keep going.</ol>':''}</div>`)
      const hit=()=>page.locator('#history').evaluate(element=>{const r=element.getBoundingClientRect();return element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})
      expect(await hit()).toBe(true)
      await page.addStyleTag({content:'.studio-editor[data-sync-state=offline]>.editor-status:not([data-font-state]),.ad-editor-shell [data-sonner-toaster][data-y-position=top]{inset-block-start:12px}'})
      expect(await hit()).toBe(false)
    }
  }finally{await browser.close()}
})

it.each(["S92.02","S91.03"])("waits for actual final dialog copy without accepting absent or stale content: %s",async code=>{
  const entry=(await readRegistry()).find(entry=>entry.code===code)!,browser=await chromium.launch()
  try{
    const page=await browser.newPage();page.setDefaultTimeout(300)
    const copy=entry.assertions.copyKeys.map(key=>resolveCopy(key,entry.assertions.copyValues))
    await page.setContent('<style>body{font:14px Arial;color:#222;background:white}dialog{background:white}</style><dialog><p>Credits added. Updating your balance…</p></dialog>')
    await expect(waitForScenarioDialog(page,entry)).rejects.toThrow()
    await page.locator('dialog').evaluate(element=>(element as HTMLDialogElement).showModal())
    await expect(waitForScenarioDialog(page,entry)).rejects.toThrow()
    await page.locator('dialog').evaluate((element,texts)=>{element.replaceChildren(...texts.map(text=>{const p=document.createElement('p');p.textContent=text;return p}))},copy)
    await waitForScenarioDialog(page,entry)
    await expect(assertScenarioOwnedCopy(page,entry)).resolves.toBeUndefined()
    if(code==="S91.03"){
      await page.locator('dialog p').nth(1).evaluate(element=>{element.textContent="Your balance is now $39.00. Credits added."})
      await expect(waitForScenarioDialog(page,entry)).rejects.toThrow()
      await page.locator('dialog p').nth(1).evaluate((element,text)=>{element.textContent=text},copy[1]!)
    }
    await page.locator('dialog p').first().evaluate(element=>element.remove())
    await expect(waitForScenarioDialog(page,entry)).rejects.toThrow()
  }finally{await browser.close()}
})
