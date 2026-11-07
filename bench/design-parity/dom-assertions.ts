import type {Page,Locator} from "playwright"
import {readFile} from "node:fs/promises"
import sharp from "sharp"
import {createHash} from "node:crypto"
import {iconPaths} from "../../packages/ui/src/icon/icon-paths.ts"
import {z} from "zod"
import type {Scenario} from "./registry.ts"

function failure(selector:string,check:string,expected:unknown,actual:unknown){
  return new Error(`selector=${selector} check=${check} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`)
}
export async function assertRendered(locator:Locator,control=false){
  const selector=locator.toString(),page=locator.page()
  const box=await locator.boundingBox(),viewport=page.viewportSize()
  if(!box||box.width<=0||box.height<=0||box.x<0||box.y<0||viewport&&(box.x+box.width>viewport.width||box.y+box.height>viewport.height))throw failure(selector,"required-rendered-element","positive box inside viewport",box)
  if(control){
    const hit=await locator.evaluate(element=>{
      const rect=element.getBoundingClientRect(),target=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)
      return target!==null&&element.contains(target)
    })
    if(!hit)throw failure(selector,"hit-test",true,hit)
  }
  const clip={x:Math.floor(box.x),y:Math.floor(box.y),width:Math.ceil(box.x+box.width)-Math.floor(box.x),height:Math.ceil(box.y+box.height)-Math.floor(box.y)}
  const before=await page.screenshot({clip,animations:"disabled",caret:"hide"})
  const element=await locator.elementHandle()
  if(!element)throw failure(selector,"required-rendered-element","attached element",null)
  const original=await element.getAttribute("style")
  let after:Buffer
  try{
    await element.evaluate(node=>node.style.setProperty("visibility","hidden","important"))
    after=await page.screenshot({clip,animations:"disabled",caret:"hide"})
  }finally{
    await element.evaluate((node,saved)=>{if(saved===null)node.removeAttribute("style");else node.setAttribute("style",saved)},original)
    await element.dispose()
  }
  const [left,right]=await Promise.all([sharp(before).ensureAlpha().raw().toBuffer(),sharp(after).ensureAlpha().raw().toBuffer()])
  let changed=0
  for(let index=0;index<left.length;index+=4)if(Math.max(Math.abs(left[index]!-right[index]!),Math.abs(left[index+1]!-right[index+1]!),Math.abs(left[index+2]!-right[index+2]!))>=32)changed++
  const minimum=Math.max(4,Math.ceil(clip.width*clip.height*0.002))
  if(changed<minimum)throw failure(selector,"required-rendered-element:paint",{minimumChangedPixels:minimum,channelDelta:32},{changedPixels:changed,box})
}
async function visible(page:Page,text:string){
  const candidates=[page.getByText(text,{exact:true}),page.getByRole("link",{name:text,exact:true}),page.getByRole("button",{name:text,exact:true})]
  for(const locator of candidates)for(const element of await locator.all()){
    try{await assertRendered(element);return}catch{}
  }
  throw failure(`text=${text}`,"required-visible-copy","painted exact copy","no painted candidate")
}
async function assertStructure(page:Page,entry:Scenario){
  for(const icon of entry.assertions.structure.icons){
    const locator=page.locator(icon.region).locator(`svg[data-icon="${icon.name}"]`).first()
    if(!await locator.count())throw failure(locator.toString(),"required-icon",1,0)
    await assertRendered(locator)
    const path=Reflect.get(iconPaths,icon.name)
    if(typeof path!=="string")throw failure(locator.toString(),"icon-geometry","registered icon name",icon.name)
    const geometry=await locator.evaluate((element,expectedPath)=>{
      const reference=document.createElementNS("http://www.w3.org/2000/svg","svg"),referencePath=document.createElementNS("http://www.w3.org/2000/svg","path")
      reference.setAttribute("style","position:fixed;inset:0;width:0;height:0;visibility:hidden!important")
      referencePath.style.setProperty("d",`path("${expectedPath}")`,"important")
      reference.append(referencePath)
      document.body.append(reference)
      try{
        return {canonicalPath:getComputedStyle(referencePath).getPropertyValue("d"),actual:{viewBox:element.getAttribute("viewBox"),transform:getComputedStyle(element).transform,parts:[...element.querySelectorAll("*")].map(part=>({tag:part.tagName,paintedPath:getComputedStyle(part).getPropertyValue("d"),transform:getComputedStyle(part).transform,attributes:[...part.attributes].filter(attribute=>["d","cx","cy","r","x","y","width","height","x1","x2","y1","y2","points","transform"].includes(attribute.name)).map(attribute=>[attribute.name,attribute.value]).sort()}))}}
      }finally{reference.remove()}
    },path)
    const tokens=(value:string)=>value.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)?.map(token=>/^[a-zA-Z]$/.test(token) ? token : Number(token))??[]
    const hash=(value:typeof geometry.actual)=>createHash("sha256").update(JSON.stringify({viewBox:tokens(value.viewBox??""),transform:value.transform,parts:value.parts.map(part=>({...part,attributes:part.attributes.map(([name,value])=>[name,tokens(value??"")])}))})).digest("hex")
    const expected=hash({viewBox:"0 0 24 24",transform:"none",parts:[{tag:"path",paintedPath:geometry.canonicalPath,transform:"none",attributes:[["d",path]]}]})
    const actual=hash(geometry.actual)
    if(actual!==expected)throw failure(locator.toString(),"icon-geometry",expected,actual)
  }
  for(const text of entry.assertions.structure.textRoles){
    const locators=page.locator(text.selector)
    if(!await locators.count())throw failure(text.selector,"required-text-role",">=1",0)
    for(const locator of await locators.all()){
      await assertRendered(locator)
      const result=await locator.evaluate(element=>{
        const style=getComputedStyle(element)
        let background="rgb(255, 255, 255)"
        for(let node:Element|null=element;node;node=node.parentElement){
          const color=getComputedStyle(node).backgroundColor
          if(color!=="rgba(0, 0, 0, 0)"&&color!=="transparent"){background=color;break}
        }
        return {family:style.fontFamily,size:parseFloat(style.fontSize),weight:Number(style.fontWeight),color:style.color,background}
      })
      const sizes={"landing-hero":[104,104,400],"pricing-title":[48,48,600],"page-title":[26,26,600],"dialog-title":[17,17,600],"module-title":[15,15,600],body:[13,14,400],helper:[12,12,400]}[text.role]
      if(result.family.split(",")[0]?.replaceAll(/["']/g,"").trim()!==(text.role==="landing-hero" ? "Newsreader" : "Geist")||result.size<sizes[0]!||result.size>sizes[1]!||result.weight!==sizes[2])throw failure(text.selector,`text-token:${text.role}`,{family:text.role==="landing-hero" ? "Newsreader" : "Geist",sizes},result)
      const expected={ink:[34,34,34],"gray.600":[102,102,102],"gray.500":[144,144,144]}[text.color]
      const channels=(color:string)=>color.match(/[\d.]+/g)?.map(Number)??[]
      const foreground=channels(result.color),background=channels(result.background)
      if(expected.some((channel,index)=>foreground[index]!==channel)||foreground.length===4&&foreground[3]!==1)throw failure(text.selector,`text-color:${text.role}`,expected,result.color)
      const luminance=(rgb:number[])=>rgb.slice(0,3).reduce((sum,value,index)=>{const channel=value/255;return sum+(channel<=0.04045 ? channel/12.92 : ((channel+0.055)/1.055)**2.4)*[0.2126,0.7152,0.0722][index]!},0)
      const light=luminance(foreground),dark=luminance(background),contrast=(Math.max(light,dark)+0.05)/(Math.min(light,dark)+0.05)
      if(contrast<text.minimumContrast)throw failure(text.selector,`text-contrast:${text.role}`,text.minimumContrast,contrast)
    }
  }
}
export async function assertScenarioStructure(page:Page,entry:Scenario){
  try{await assertStructure(page,entry)}catch(error){throw new Error(`scenario=${entry.code} ${String(error)}`)}
}
export async function assertScenarioCopy(page:Page,keys:string[],scenario="copy-entry"){
  const copy=z.record(z.string(),z.unknown()).parse(JSON.parse(await readFile(new URL("../../docs/design/v0.1/copy-kit.json",import.meta.url),"utf8")))
  for(const key of keys){
    const text=z.string().parse(copy[key])
    try{await visible(page,text)}catch(error){throw new Error(`scenario=${scenario} ${String(error)}`)}
  }
}
async function assertDOM(page:Page,entry:Scenario){
  await assertScenarioCopy(page,entry.assertions.copyKeys,entry.code)
  for(const text of entry.assertions.texts)await visible(page,text)
  for(const control of entry.assertions.controls){
    const locator=page.getByRole(control.role,{name:control.name,exact:true}).first()
    if(!await locator.count())throw failure(locator.toString(),"required-control",1,0)
    await assertRendered(locator,true)
  }
  await assertStructure(page,entry)
}
export async function assertScenarioDOM(page:Page,entry:Scenario){
  try{await assertDOM(page,entry)}catch(error){throw new Error(`scenario=${entry.code} ${String(error)}`)}
}
async function probeInteraction(page:Page,entry:Scenario){
  const probe=entry.assertions.probe
  switch(probe.kind){
    case "fill":{
      const previousFocus=await page.$(":focus")
      const field=page.getByLabel(probe.label,{exact:true}),original=await field.inputValue()
      await field.fill(probe.value)
      if(await field.inputValue()!==probe.value)throw new Error("input-probe-failed")
      await field.fill(original)
      await field.blur()
      await previousFocus?.focus()
      break
    }
    case "dialog":{
      await page.getByRole("button",{name:probe.open,exact:true}).first().click()
      const dialog=page.getByRole("dialog",{name:probe.title,exact:true})
      await dialog.waitFor({state:"visible"})
      await dialog.getByRole("button",{name:probe.close,exact:true}).click()
      await dialog.waitFor({state:"hidden"})
      break
    }
    case "view":{
      const single=page.getByRole("button",{name:"Single slide view",exact:true}),grid=page.getByRole("button",{name:"Grid view",exact:true})
      await page.getByRole("button",{name:"Slide 3",exact:true}).click()
      await single.click()
      if(await single.getAttribute("aria-pressed")!=="true"||await grid.getAttribute("aria-pressed")!=="false")throw new Error("view-probe-failed")
      await grid.click()
      if(await grid.getAttribute("aria-pressed")!=="true")throw new Error("view-probe-restore-failed")
      break
    }
    case "navigate":{
      const original=page.url()
      await page.getByRole("link",{name:probe.name,exact:true}).first().click()
      await page.waitForURL(url=>url.pathname+url.hash===probe.path)
      await page.goto(original)
      break
    }
    case "approval":
      await page.getByRole("button",{name:"Cancel",exact:true}).click()
      await page.getByRole("heading",{name:"Connection cancelled",exact:true}).waitFor()
      break
    case "expired":
      await page.getByRole("button",{name:"Send a new link",exact:true}).click()
      await page.getByRole("heading",{name:"Sign in",exact:true}).waitFor()
      await page.reload()
      await page.getByRole("heading",{name:"This link has expired",exact:true}).waitFor()
      break
    default:{const exhaustive:never=probe;throw new Error(String(exhaustive))}
  }
}
export async function probeScenarioInteraction(page:Page,entry:Scenario){
  try{await probeInteraction(page,entry)}catch(error){throw new Error(`scenario=${entry.code} selector=probe:${entry.assertions.probe.kind} check=interaction expected=${JSON.stringify(entry.assertions.probe)} actual=${JSON.stringify(String(error))}`)}
}
