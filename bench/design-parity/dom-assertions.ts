import type {Page,Locator} from "playwright"
import sharp from "sharp"
import {createHash} from "node:crypto"
import {iconPaths,iconStrokeWidth,isIconName} from "../../packages/ui/src/icon/icon-paths.ts"
import {resolveCopy,type Scenario} from "./registry.ts"

function failure(selector:string,check:string,expected:unknown,actual:unknown){
  return new Error(`selector=${selector} check=${check} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`)
}
export const textRoleSizes={"landing-hero":[104,104,400],"pricing-title":[52,52,600],"page-title":[26,26,600],"access-error-title":[15,15,500],"dialog-title":[17,17,600],"module-title":[15,15,600],body:[13,14,400],helper:[12,12,400]}

type IconInk={path:string,size:number,color:string,strokeWidth:ReturnType<typeof iconStrokeWidth>}
function inkPixels(pixels:Buffer){
  const colors=new Map<number,number>()
  for(let index=0;index<pixels.length;index+=4){
    const key=(pixels[index]!>>3)*1024+(pixels[index+1]!>>3)*32+(pixels[index+2]!>>3)
    colors.set(key,(colors.get(key)??0)+1)
  }
  const dominant=[...colors].sort((a,b)=>b[1]-a[1])[0]![0]
  const background=[(dominant>>10)*8+4,((dominant>>5)&31)*8+4,(dominant&31)*8+4]
  let ink=0
  for(let index=0;index<pixels.length;index+=4)if(background.some((channel,offset)=>Math.abs(pixels[index+offset]!-channel)>=32))ink++
  return ink
}
async function assertPaintedText(locator:Locator,clip:{x:number,y:number,width:number,height:number},before:Buffer){
  const snapshot=await locator.evaluateHandle(element=>{
    const parents=new Set<HTMLElement|SVGElement>()
    const texts:{estimate:number,rects:{left:number,top:number,right:number,bottom:number}[]}[]=[]
    if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement){
      const text=element.value||element.placeholder,box=element.getBoundingClientRect()
      if(text.trim())texts.push({estimate:[...text.replace(/\s/g,"")].length*parseFloat(getComputedStyle(element).fontSize)**2*0.18,rects:[{left:box.left,top:box.top,right:box.right,bottom:box.bottom}]})
      parents.add(element)
    }else{
      const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT)
      while(walker.nextNode()){
        const node=walker.currentNode,parent=node.parentElement,text=node.textContent??""
        if(!text.trim()||!parent||["SCRIPT","STYLE"].includes(parent.tagName))continue
        const range=document.createRange()
        range.selectNodeContents(node)
        texts.push({estimate:[...text.replace(/\s/g,"")].length*parseFloat(getComputedStyle(parent).fontSize)**2*0.18,rects:[...range.getClientRects()].map(rect=>({left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}))})
        parents.add(parent)
      }
    }
    return {texts,styles:[...parents].map(element=>{
      const clone=element.cloneNode(false)
      if(!(clone instanceof HTMLElement||clone instanceof SVGElement))throw new Error("invalid-label-style-snapshot")
      return {element,style:element.getAttribute("style"),roundTrips:clone.style.cssText===element.style.cssText,properties:["-webkit-text-fill-color","-webkit-text-stroke-color","text-shadow"].map(name=>({name,value:element.style.getPropertyValue(name),priority:element.style.getPropertyPriority(name)}))}
    })}
  })
  try{
    const texts=await snapshot.evaluate(saved=>saved.texts)
    if(!texts.length)throw failure(locator.toString(),"required-rendered-element:text-ink-ownership","nonempty DOM label",texts)
    await snapshot.evaluate(saved=>{
      for(const {element} of saved.styles){
        element.style.setProperty("-webkit-text-fill-color","transparent","important")
        element.style.setProperty("-webkit-text-stroke-color","transparent","important")
        element.style.setProperty("text-shadow","none","important")
      }
    })
    const after=await locator.page().screenshot({clip,animations:"disabled",caret:"initial",style:"*{caret-color:transparent!important}"})
    const [left,right]=await Promise.all([sharp(before).ensureAlpha().raw().toBuffer(),sharp(after).ensureAlpha().raw().toBuffer()])
    for(const text of texts){
      let ink=0
      for(let index=0;index<left.length;index+=4){
        const pixel=index/4,x=clip.x+pixel%clip.width+0.5,y=clip.y+Math.floor(pixel/clip.width)+0.5
        if(!text.rects.some(rect=>x>=rect.left&&x<rect.right&&y>=rect.top&&y<rect.bottom))continue
        if([0,1,2].some(channel=>Math.abs((left[index+channel]??0)-(right[index+channel]??0))>=32))ink++
      }
      if(!Number.isFinite(text.estimate)||text.estimate<=0||ink<text.estimate/4||ink>text.estimate*4)throw failure(locator.toString(),"required-rendered-element:text-ink-ownership",{minimumInk:text.estimate/4,maximumInk:text.estimate*4},{ink,rects:text.rects})
    }
  }finally{
    try{await snapshot.evaluate(saved=>{for(const {element,style,roundTrips,properties} of saved.styles){for(const {name,value,priority} of properties){if(value)element.style.setProperty(name,value,priority);else element.style.removeProperty(name)}if(roundTrips){element.setAttribute("style",style??"");if(style===null)element.removeAttribute("style")}}})}finally{await snapshot.dispose()}
  }
}
export async function assertRendered(locator:Locator,control=false,icon?:IconInk){
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
  const before=await page.screenshot({clip,animations:"disabled",caret:icon?"hide":"initial",style:icon?undefined:"*{caret-color:transparent!important}"})
  if(!icon)return assertPaintedText(locator,clip,before)
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
  const beforeInk=inkPixels(left),afterInk=inkPixels(right)
  const estimate=inkPixels(await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${icon.size}" height="${icon.size}" viewBox="0 0 24 24"><rect width="24" height="24" fill="white"/><path d="${icon.path}" fill="none" stroke="${icon.color}" stroke-width="${icon.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`)).ensureAlpha().raw().toBuffer())
  const ownership=beforeInk>0 ? (beforeInk-afterInk)/beforeInk : 0
  if(ownership<0.8||estimate<=0||beforeInk<estimate/4||beforeInk>estimate*4)throw failure(selector,"required-rendered-element:ink-ownership",{minimumOwnership:0.8,minimumInk:estimate/4,maximumInk:estimate*4},{beforeInk,afterInk,ownership,box})
}
async function visible(page:Page,text:string){
  const candidates=[page.getByText(text,{exact:true}),page.getByRole("link",{name:text,exact:true}),page.getByRole("button",{name:text,exact:true})]
  for(const locator of candidates)for(const element of await locator.all()){
    try{await assertRendered(element);return}catch{}
  }
  throw failure(`text=${text}`,"required-visible-copy","painted exact copy","no painted candidate")
}
export async function assertDialogActions(page:Page,entry:Scenario){
  const actions=entry.assertions.structure.dialogActions
  if(!actions)return
  const dialog=page.locator(entry.component?.selector??"dialog[open]")
  for(const [key,kind] of [[actions.primaryKey,"destructive"],[actions.cancelKey,"cancel"]]){
    const button=dialog.getByRole("button",{name:resolveCopy(key!,entry.assertions.copyValues),exact:true})
    await assertRendered(button,true)
    const style=await button.evaluate(element=>{
      const style=getComputedStyle(element),range=document.createRange()
      range.selectNodeContents(element)
      const lines=[...new Set([...range.getClientRects()].filter(rect=>rect.width>0).map(rect=>Math.round(rect.top)))]
      return {lines:lines.length,overflow:element.scrollWidth>element.clientWidth,background:style.backgroundColor,color:style.color,borders:[style.borderTopColor,style.borderRightColor,style.borderBottomColor,style.borderLeftColor],widths:[style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth],styles:[style.borderTopStyle,style.borderRightStyle,style.borderBottomStyle,style.borderLeftStyle],height:element.getBoundingClientRect().height,radius:style.borderRadius}
    })
    const expected=kind==="destructive" ? {background:"rgb(217, 63, 63)",color:"rgb(255, 255, 255)",border:"rgb(185, 47, 47)"} : {background:"rgb(255, 255, 255)",color:"rgb(34, 34, 34)",border:"rgb(215, 215, 214)"}
    if(style.lines!==1||style.overflow)throw failure(button.toString(),"dialog-action-single-line",1,style)
    if(style.background!==expected.background||style.color!==expected.color||style.borders.some(color=>color!==expected.border)||style.widths.some(width=>width!=="1px")||style.styles.some(border=>border!=="solid")||style.height!==36||style.radius!=="8px")throw failure(button.toString(),`dialog-action-${kind}-tokens`,expected,style)
  }
}
async function assertComponentContent(page:Page,entry:Scenario){
  if(!entry.component)return
  const locator=page.locator(entry.component.selector)
  if(await locator.count()!==1)throw failure(entry.component.selector,"component-must-be-unique",1,await locator.count())
  const violations=await locator.evaluate(component=>{
    const box=component.getBoundingClientRect(),outside:string[]=[],rasters:{tag:string,share:number}[]=[]
    const visible=(element:Element)=>{
      for(let node:Element|null=element;node;node=node.parentElement){
        const style=getComputedStyle(node)
        if(style.display==="none"||style.visibility!=="visible"||Number(style.opacity)===0)return false
      }
      return true
    }
    const contained=(rect:DOMRect)=>rect.width<=0||rect.height<=0||rect.left>=box.left-1&&rect.top>=box.top-1&&rect.right<=box.right+1&&rect.bottom<=box.bottom+1
    const walker=document.createTreeWalker(component,NodeFilter.SHOW_TEXT)
    while(walker.nextNode()){
      const node=walker.currentNode,parent=node.parentElement
      if(!node.textContent?.trim()||!parent||!visible(parent)||["SCRIPT","STYLE"].includes(parent.tagName))continue
      const range=document.createRange();range.selectNodeContents(node)
      if([...range.getClientRects()].some(rect=>!contained(rect)))outside.push(node.textContent.trim())
    }
    for(const element of component.querySelectorAll("button,input,textarea,select,a[href],[role=button],[role=link],[role=textbox],[tabindex]")){
      if(visible(element)&&!contained(element.getBoundingClientRect()))outside.push(element.outerHTML.slice(0,160))
    }
    for(const element of [component,...component.querySelectorAll("*")]){
      if(!visible(element))continue
      const style=getComputedStyle(element)
      if(!["IMG","CANVAS"].includes(element.tagName)&&style.backgroundImage==="none")continue
      const rect=element.getBoundingClientRect()
      const share=Math.max(0,Math.min(rect.right,box.right)-Math.max(rect.left,box.left))*Math.max(0,Math.min(rect.bottom,box.bottom)-Math.max(rect.top,box.top))/(box.width*box.height)
      if(share>0.1)rasters.push({tag:element.tagName,share})
    }
    return {outside,rasters}
  })
  if(violations.outside.length)throw failure(entry.component.selector,"component-content-outside","visible text and controls inside component",violations.outside)
  if(violations.rasters.length)throw failure(entry.component.selector,"component-raster-coverage",{maximumShare:0.1},violations.rasters)
}
async function assertStructure(page:Page,entry:Scenario){
  await assertComponentContent(page,entry)
  await assertDialogActions(page,entry)
  for(const icon of entry.assertions.structure.icons){
    const locator=page.locator(icon.region).locator(`svg[data-icon="${icon.name}"]`).first()
    if(!await locator.count())throw failure(locator.toString(),"required-icon",1,0)
    if(!isIconName(icon.name))throw failure(locator.toString(),"icon-geometry","registered icon name",icon.name)
    const path=iconPaths[icon.name]
    const expectedColor={ink:"rgb(34, 34, 34)","gray.600":"rgb(102, 102, 102)","gray.500":"rgb(144, 144, 144)"}[icon.color]
    const appearance=await locator.evaluate(element=>{
      const box=element.getBoundingClientRect()
      return {width:box.width,height:box.height,parts:[...element.querySelectorAll("path")].map(part=>{const style=getComputedStyle(part);return {stroke:style.stroke,fill:style.fill,width:style.strokeWidth,opacity:style.opacity,strokeOpacity:style.strokeOpacity}})}
    })
    if(appearance.width!==icon.size||appearance.height!==icon.size)throw failure(locator.toString(),"icon-size",icon.size,appearance)
    const expectedStroke=iconStrokeWidth(icon.name)
    if(appearance.parts.some(part=>part.stroke!==expectedColor||part.fill!=="none"))throw failure(locator.toString(),"icon-color",expectedColor,appearance)
    if(appearance.parts.some(part=>part.width!==expectedStroke+"px"))throw failure(locator.toString(),"icon-stroke",expectedStroke,appearance)
    if(appearance.parts.some(part=>part.opacity!=="1"||part.strokeOpacity!=="1"))throw failure(locator.toString(),"icon-opacity",1,appearance)
    const geometry=await locator.evaluate((element,expectedPath)=>{
      const reference=document.createElementNS("http://www.w3.org/2000/svg","svg"),referencePath=document.createElementNS("http://www.w3.org/2000/svg","path")
      reference.setAttribute("style","position:fixed;inset:0;width:0;height:0;visibility:hidden!important")
      referencePath.style.setProperty("d",`path("${expectedPath}")`,"important")
      reference.append(referencePath)
      document.body.append(reference)
      try{
        return {canonicalPath:getComputedStyle(referencePath).getPropertyValue("d"),actual:{viewBox:element.getAttribute("viewBox"),transform:getComputedStyle(element).transform,parts:[...element.querySelectorAll("*")].map(part=>({tag:part.tagName,paintedPath:getComputedStyle(part).getPropertyValue("d"),transform:getComputedStyle(part).transform,attributes:[...part.attributes].filter(attribute=>["cx","cy","r","x","y","width","height","x1","x2","y1","y2","points","transform"].includes(attribute.name)).map(attribute=>[attribute.name,attribute.value]).sort()}))}}
      }finally{reference.remove()}
    },path)
    const tokens=(value:string)=>value.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)?.map(token=>/^[a-zA-Z]$/.test(token) ? token : Number(token))??[]
    const hash=(value:typeof geometry.actual)=>createHash("sha256").update(JSON.stringify({viewBox:tokens(value.viewBox??""),transform:value.transform,parts:value.parts.map(part=>({...part,attributes:part.attributes.map(([name,value])=>[name,tokens(value??"")])}))})).digest("hex")
    const expected=hash({viewBox:"0 0 24 24",transform:"none",parts:[{tag:"path",paintedPath:geometry.canonicalPath,transform:"none",attributes:[]}]})
    const actual=hash(geometry.actual)
    if(actual!==expected)throw failure(locator.toString(),"icon-geometry",expected,actual)
    await assertRendered(locator,false,{path,size:icon.size,color:expectedColor,strokeWidth:expectedStroke})
  }
  for(const text of entry.assertions.structure.textRoles){
    const selector="componentSelector" in text ? `${entry.component?.selector} >> ${text.componentSelector}` : text.selector
    let locators:Locator
    if("componentSelector" in text){
      if(entry.component?.kind!=="dialog")throw failure(selector,"required-dialog-component","registered dialog",entry.component)
      const root=page.locator(entry.component.selector),count=await root.count()
      if(count!==1)throw failure(entry.component.selector,"required-dialog-component",1,count)
      if(!await root.evaluate(element=>element.matches('dialog[open], [role="dialog"], [role="alertdialog"]')))throw failure(entry.component.selector,"required-dialog-semantics","open native or ARIA dialog",await root.evaluate(element=>element.outerHTML))
      if(!await root.evaluate((element,selector)=>[...element.querySelectorAll(selector)].every(title=>title.closest('dialog[open], [role="dialog"], [role="alertdialog"]')===element),text.componentSelector))throw failure(selector,"dialog-title-ownership","title owned by registered dialog","title belongs to another dialog")
      locators=root.locator(text.componentSelector)
    }else locators=page.locator(text.selector)
    if(!await locators.count())throw failure(selector,"required-text-role",">=1",0)
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
      const sizes=textRoleSizes[text.role]
      if(result.family.split(",")[0]?.replaceAll(/["']/g,"").trim()!==(text.role==="landing-hero" ? "Newsreader" : "Geist")||result.size<sizes[0]!||result.size>sizes[1]!||result.weight!==sizes[2])throw failure(selector,`text-token:${text.role}`,{family:text.role==="landing-hero" ? "Newsreader" : "Geist",sizes},result)
      const expected={ink:[34,34,34],"gray.600":[102,102,102],"gray.500":[144,144,144]}[text.color]
      const channels=(color:string)=>color.match(/[\d.]+/g)?.map(Number)??[]
      const foreground=channels(result.color),background=channels(result.background)
      if(expected.some((channel,index)=>foreground[index]!==channel)||foreground.length===4&&foreground[3]!==1)throw failure(selector,`text-color:${text.role}`,expected,result.color)
      const luminance=(rgb:number[])=>rgb.slice(0,3).reduce((sum,value,index)=>{const channel=value/255;return sum+(channel<=0.04045 ? channel/12.92 : ((channel+0.055)/1.055)**2.4)*[0.2126,0.7152,0.0722][index]!},0)
      const light=luminance(foreground),dark=luminance(background),contrast=(Math.max(light,dark)+0.05)/(Math.min(light,dark)+0.05)
      if(contrast<text.minimumContrast)throw failure(selector,`text-contrast:${text.role}`,text.minimumContrast,contrast)
    }
  }
}
export async function assertScenarioStructure(page:Page,entry:Scenario){
  try{await assertStructure(page,entry)}catch(error){throw new Error(`scenario=${entry.code} ${String(error)}`)}
}
export async function assertScenarioCopy(page:Page,keys:string[],scenario="copy-entry",values:Record<string,string>={}){
  for(const key of keys){
    const text=resolveCopy(key,values)
    try{await visible(page,text)}catch(error){throw new Error(`scenario=${scenario} ${String(error)}`)}
  }
}
async function assertDOM(page:Page,entry:Scenario){
  await assertScenarioCopy(page,entry.assertions.copyKeys,entry.code,entry.assertions.copyValues)
  for(const control of entry.assertions.controls){
    const locator=page.getByRole(control.role,{name:control.role==="searchbox" ? control.name : resolveCopy(control.nameKey,entry.assertions.copyValues),exact:true}).first()
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
      const accountMenu=page.getByLabel("Account menu",{exact:true})
      const accountSignOut=probe.open===resolveCopy("access.sign_out")
      if(accountSignOut){
        await accountMenu.waitFor({state:"visible"})
        if(await accountMenu.evaluate(element=>element.closest("details")?.open!==false))throw new Error("account-menu-probe-restore-failed")
        await accountMenu.click()
      }
      await page.getByRole("button",{name:probe.open,exact:true}).first().click()
      const dialog=page.getByRole("dialog",{name:resolveCopy(probe.titleKey,entry.assertions.copyValues),exact:true})
      await dialog.waitFor({state:"visible"})
      await dialog.getByRole("button",{name:probe.close,exact:true}).click()
      await dialog.waitFor({state:"hidden"})
      if(accountSignOut){
        await accountMenu.waitFor({state:"visible"})
        if(await accountMenu.evaluate(element=>element.closest("details")?.open!==false))throw new Error("account-menu-probe-restore-failed")
      }
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
      await page.getByRole("heading",{name:resolveCopy("access.entry_title"),exact:true}).waitFor()
      await page.reload()
      await page.getByRole("heading",{name:"This link has expired",exact:true}).waitFor()
      break
    default:{const exhaustive:never=probe;throw new Error(String(exhaustive))}
  }
}
export async function probeScenarioInteraction(page:Page,entry:Scenario){
  try{await probeInteraction(page,entry)}catch(error){throw new Error(`scenario=${entry.code} selector=probe:${entry.assertions.probe.kind} check=interaction expected=${JSON.stringify(entry.assertions.probe)} actual=${JSON.stringify(String(error))}`)}
}
