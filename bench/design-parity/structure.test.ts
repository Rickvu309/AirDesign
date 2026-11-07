import {chromium} from "playwright"
import {expect,it} from "vitest"
import {assertScenarioDOM,assertRendered} from "./dom-assertions.ts"
import {iconPaths} from "../../packages/ui/src/icon/icon-paths.ts"
import {readRegistry} from "./registry.ts"
it("rejects transparent bitmap substitute DOM, missing and swapped icons, wrong fonts and low contrast",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry={...original,assertions:{...original.assertions,copyKeys:["decks.recents"],controls:[{role:"button",nameKey:"shell.command"}],structure:{icons:[{region:"main",name:"search",size:16,color:"ink" as const}],textRoles:[{selector:"time",role:"helper",color:"gray.500",minimumContrast:3}]}}} satisfies typeof original
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    page.setDefaultTimeout(500)
    const content=`<style>body{background:white}time{font:400 12px Geist;color:#909090}</style><main><h1>Recents</h1><button>Commands</button><svg data-icon="search" viewBox="0 0 24 24" width="16" height="16"><path d="${iconPaths.search}" stroke="#222" stroke-width="1.5" fill="none"/></svg><time>Edited today</time></main>`
    await page.setContent(content)
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    for(const [name,mutation] of [
      ["filtered","document.querySelector('main').style.filter='opacity(0)'"],
      ["mislabeled-geometry","document.querySelector('path').setAttribute('d','M2 2L14 14M14 2L2 14')"],
      ["transparent","document.querySelector('main').style.opacity='0'"],
      ["erased","document.querySelector('svg').remove()"],
      ["swapped","document.querySelector('svg').dataset.icon='trash'"],
      ["unpainted","document.querySelector('path').style.stroke='none'"],
      ["transparent-paint","document.querySelector('path').style.stroke='transparent'"],
      ["hidden-geometry","document.querySelector('path').style.visibility='hidden'"],
      ["faint-geometry","document.querySelector('path').style.opacity='0.01'"],
      ["zero-geometry","document.querySelector('path').setAttribute('d','')"],
      ["outside-geometry","document.querySelector('path').style.transform='translateX(1000px)'"],
      ["low-contrast","document.querySelector('time').style.color='#eee'"],
      ["low-background-contrast","document.querySelector('time').style.backgroundColor='#909090'"],
      ["wrong-font","document.querySelector('time').style.fontFamily='Arial'"],
      ["wrong-size","document.querySelector('time').style.fontSize='9px'"],
      ["wrong-weight","document.querySelector('time').style.fontWeight='600'"]
    ]){
      await page.setContent(content)
      await page.evaluate(mutation!)
      await expect(assertScenarioDOM(page,entry),name).rejects.toThrow()
    }
    for(const style of ["opacity:0","opacity:0.1","visibility:hidden","display:none","clip-path:inset(50%)","position:absolute;clip:rect(0,0,0,0)","width:0;height:0;overflow:hidden","position:absolute;left:-1000px","position:absolute;top:1000px","position:absolute;left:-5px","width:1px;overflow:hidden","width:1px;overflow-x:clip"]){
      await page.setContent(`<div style="${style}"><button>Commands</button></div>`)
      await expect(assertRendered(page.locator("button"),true),style).rejects.toThrow()
    }
    await page.setContent('<button>Commands</button><div style="position:fixed;inset:0;background:white"></div>')
    await expect(assertRendered(page.locator("button"),true)).rejects.toThrow()
    await page.setContent('<button><span>Commands</span></button>')
    await expect(assertRendered(page.locator("button"),true)).resolves.toBeUndefined()
  }finally{await browser.close()}
})
