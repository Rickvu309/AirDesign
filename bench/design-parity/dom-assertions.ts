import type {Page,Locator} from "playwright"
import {readFile} from "node:fs/promises"
import {z} from "zod"
import type {Scenario} from "./registry.ts"

export async function assertRendered(locator:Locator,control=false){
  const rendered=await locator.evaluate((element,hitTest)=>{
    const rect=element.getBoundingClientRect()
    if(rect.width<=0||rect.height<=0||rect.left<0||rect.top<0||rect.right>innerWidth||rect.bottom>innerHeight)return false
    let opacity=1
    for(let node:Element|null=element;node;node=node.parentElement){
      const style=getComputedStyle(node)
      opacity*=Number(style.opacity)
      if(opacity<0.95||style.display==="none"||style.visibility!=="visible"||style.contentVisibility==="hidden"||style.clipPath!=="none"||style.clip!=="auto")return false
      if([style.overflowX,style.overflowY].some(overflow=>overflow==="hidden"||overflow==="clip")){
        const bounds=node.getBoundingClientRect()
        if((style.overflowX==="hidden"||style.overflowX==="clip")&&(rect.left<bounds.left||rect.right>bounds.right))return false
        if((style.overflowY==="hidden"||style.overflowY==="clip")&&(rect.top<bounds.top||rect.bottom>bounds.bottom))return false
      }
    }
    if(hitTest){
      const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)
      if(!hit||!element.contains(hit))return false
    }
    return true
  },control)
  if(!rendered)throw new Error("required-rendered-element")
}
async function visible(page:Page,text:string){
  const candidates=[page.getByText(text,{exact:true}),page.getByRole("link",{name:text,exact:true}),page.getByRole("button",{name:text,exact:true})]
  for(const locator of candidates)for(const element of await locator.all()){
    try{await assertRendered(element);return}catch{}
  }
  throw new Error(`required-visible-copy:${text}`)
}
export async function assertScenarioStructure(page:Page,entry:Scenario){
  for(const icon of entry.assertions.structure.icons){
    const locator=page.locator(icon.region).locator(`svg[data-icon="${icon.name}"]`).first()
    if(!await locator.count())throw new Error(`required-icon:${icon.name}`)
    await assertRendered(locator)
    if(!await locator.locator("path,circle,rect,line,polyline,polygon").count())throw new Error(`empty-icon:${icon.name}`)
    const painted=await locator.evaluate(element=>[...element.querySelectorAll("path,circle,rect,line,polyline,polygon")].some(part=>{
      const style=getComputedStyle(part),bounds=part.getBoundingClientRect(),frame=element.getBoundingClientRect()
      if(bounds.width<=0&&bounds.height<=0||bounds.right<frame.left||bounds.left>frame.right||bounds.bottom<frame.top||bounds.top>frame.bottom)return false
      const opaque=(paint:string)=>paint!=="none"&&paint!=="transparent"&&(!paint.startsWith("rgba")||Number(paint.match(/[\d.]+/g)?.at(-1))>=0.95)
      let opacity=1
      for(let node:Element|null=part;node;node=node.parentElement){
        const ancestor=getComputedStyle(node)
        opacity*=Number(ancestor.opacity)
        if(opacity<0.95||ancestor.display==="none"||ancestor.visibility!=="visible"||ancestor.clipPath!=="none"||ancestor.clip!=="auto")return false
      }
      return (opaque(style.stroke)&&Number(style.strokeOpacity)>=0.95&&parseFloat(style.strokeWidth)>0)||(opaque(style.fill)&&Number(style.fillOpacity)>=0.95)
    }))
    if(!painted)throw new Error(`unpainted-icon:${icon.name}`)
  }
  for(const text of entry.assertions.structure.textRoles){
    const locators=page.locator(text.selector)
    if(!await locators.count())throw new Error(`required-text-role:${text.role}`)
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
      if(result.family.split(",")[0]?.replaceAll(/["']/g,"").trim()!==(text.role==="landing-hero" ? "Newsreader" : "Geist")||result.size<sizes[0]!||result.size>sizes[1]!||result.weight!==sizes[2])throw new Error(`text-token:${text.role}`)
      const expected={ink:[34,34,34],"gray.600":[102,102,102],"gray.500":[144,144,144]}[text.color]
      const channels=(color:string)=>color.match(/[\d.]+/g)?.map(Number)??[]
      const foreground=channels(result.color),background=channels(result.background)
      if(expected.some((channel,index)=>foreground[index]!==channel)||foreground.length===4&&foreground[3]!==1)throw new Error(`text-color:${text.role}`)
      const luminance=(rgb:number[])=>rgb.slice(0,3).reduce((sum,value,index)=>{const channel=value/255;return sum+(channel<=0.04045 ? channel/12.92 : ((channel+0.055)/1.055)**2.4)*[0.2126,0.7152,0.0722][index]!},0)
      const light=luminance(foreground),dark=luminance(background),contrast=(Math.max(light,dark)+0.05)/(Math.min(light,dark)+0.05)
      if(contrast<text.minimumContrast)throw new Error(`text-contrast:${text.role}`)
    }
  }
}
export async function assertScenarioCopy(page:Page,keys:string[]){
  const copy=z.record(z.string(),z.unknown()).parse(JSON.parse(await readFile(new URL("../../docs/design/v0.1/copy-kit.json",import.meta.url),"utf8")))
  for(const key of keys){
    const text=z.string().parse(copy[key])
    await visible(page,text)
  }
}
export async function assertScenarioDOM(page:Page,entry:Scenario){
  await assertScenarioCopy(page,entry.assertions.copyKeys)
  for(const text of entry.assertions.texts)await visible(page,text)
  for(const control of entry.assertions.controls){
    const locator=page.getByRole(control.role,{name:control.name,exact:true}).first()
    if(!await locator.count())throw new Error(`required-control:${control.role}:${control.name}`)
    await assertRendered(locator,true)
  }
  await assertScenarioStructure(page,entry)
}
export async function probeScenarioInteraction(page:Page,entry:Scenario){
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
