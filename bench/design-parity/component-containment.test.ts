import {readFile} from "node:fs/promises"
import {chromium} from "playwright"
import {expect,it} from "vitest"
import {readRegistry,resolveCopy} from "./registry.ts"
import {assertScenarioDOM,assertScenarioStructure,probeScenarioInteraction} from "./dom-assertions.ts"

it("rejects the verifier payment raster with live copy and controls outside the dialog",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S91.03")!,box=entry.component!.designBox
  const design=await readFile(entry.design),texts=entry.assertions.copyKeys.map(key=>resolveCopy(key,entry.assertions.copyValues))
  const fonts=(await Promise.all([400,600].map(async w=>`@font-face{font-family:Geist;font-weight:${w};src:url(data:font/woff2;base64,${(await readFile(`packages/ui/fonts/geist-latin-${w}.woff2`)).toString("base64")})}`))).join("")
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:entry.viewport})
  try{
await page.setContent(`<style>${fonts}body{margin:0;background:#c0c0c0}canvas{position:fixed;inset:0;z-index:-1}#fake{position:fixed;left:535px;top:358px;box-sizing:border-box;margin:0;padding:0;border:0;width:400px;height:208px;background:transparent;overflow:visible}h2{position:absolute;left:30px;top:240px;background:white;margin:0;font:600 17px Geist;color:#222;white-space:nowrap}p{position:absolute;left:30px;top:275px;margin:0;background:white;font:400 13px Geist;color:#666;white-space:nowrap}#done{position:absolute;left:160px;top:310px;height:36px;font:600 14px Geist;border-radius:8px;border:1px solid #d7d7d6;background:white;color:#222}#open{position:absolute;left:1100px;top:800px}</style><canvas width="1470" height="923"></canvas><dialog id="fake" open><h2>${texts[0]}</h2><p>${texts[1]}</p><button id="done">${texts[2]}</button></dialog><details id="account"><summary aria-label="Account menu">Account</summary><button id="open">Sign out</button></details><dialog id="probe" aria-label="Sign out?"><button id="close">Cancel</button></dialog><script>document.querySelector('#open').onclick=()=>{document.querySelector('#account').open=false;document.querySelector('#probe').showModal()};document.querySelector('#close').onclick=()=>document.querySelector('#probe').close()</script>`);
await page.evaluate(async ({src,box})=>{await document.fonts.ready;const im=new Image();im.src=src;await im.decode();const ctx=document.querySelector("canvas")!.getContext('2d')!;ctx.fillStyle='#c0c0c0';ctx.fillRect(0,0,1470,923);ctx.drawImage(im,box.left,box.top,box.width,box.height,box.left,box.top,box.width,box.height)},{src:'data:image/png;base64,'+design.toString('base64'),box});

    await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
    await expect(assertScenarioDOM(page,entry)).rejects.toThrow(/component-(?:content-outside|raster-coverage)/)
  }finally{await browser.close()}
})

it("contains visible text and controls and limits raster coverage for all component scenarios",async()=>{
  const entries=(await readRegistry()).filter(entry=>entry.component)
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1470,height:923}})
  try{
    for(const original of entries){
      const entry={...original,assertions:{...original.assertions,structure:{...original.assertions.structure,icons:[],textRoles:[],dialogActions:undefined}}}
      const tag=entry.component!.kind==="dialog" ? "dialog" : "div"
      const html=`<style>.toast,dialog{position:fixed;left:200px;top:200px;margin:0;padding:20px;width:400px;height:200px;box-sizing:border-box}p{margin:0}</style><${tag} class="toast" data-sonner-toast role="${tag==="dialog" ? "dialog" : "status"}" open><p>Contained text</p><button>Done</button><span hidden>Hidden text</span><button hidden style="position:absolute;top:500px">Hidden control</button><img alt="" style="width:16px;height:16px"></${tag}>`
      for(const mutation of ["text","control","image","canvas","background"]){
        await page.setContent(html)
        await expect(assertScenarioStructure(page,entry)).resolves.toBeUndefined()
        await page.locator(entry.component!.selector).evaluate((element,mutation)=>{
          if(mutation==="text"||mutation==="control"){
            const target=element.querySelector(mutation==="text" ? "p" : "button")!
            target.setAttribute("style","position:absolute;top:240px")
          }else if(mutation==="background")element.setAttribute("style","background-image:linear-gradient(red,blue)")
          else{
            const raster=document.createElement(mutation==="image" ? "img" : "canvas")
            raster.setAttribute("style","position:absolute;inset:0;width:100%;height:100%")
            element.append(raster)
          }
        },mutation)
        await expect(assertScenarioStructure(page,entry),`${entry.code}:${mutation}`).rejects.toThrow(/component-(?:content-outside|raster-coverage)/)
      }
    }
  }finally{await browser.close()}
},60000)
