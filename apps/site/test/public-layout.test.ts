import {chromium} from "playwright"
import {createServer} from "vite"
import {expect,it} from "vitest"

it("keeps the public controls and mobile hero within the viewport",async()=>{
 const server=await createServer({root:"apps/site",configFile:"apps/site/vite.config.ts",server:{host:"127.0.0.1",port:0},optimizeDeps:{noDiscovery:true,include:[]}})
 await server.listen()
 const browser=await chromium.launch()
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  const url=server.resolvedUrls?.local[0]
  if(!url)throw new Error("Site server has no local URL")
  await page.goto(url)
  const layout=await page.evaluate(()=>{
   const header=document.querySelector("header")!.getBoundingClientRect()
   const badge=document.querySelector(".chart-callout")!.getBoundingClientRect()
   const frame=document.querySelector(".demo-workspace")!
   const image=document.querySelector("#product img")!.getBoundingClientRect()
   const chart=document.querySelector<SVGGeometryElement>(".chart-line")!
   let low=0,high=chart.getTotalLength()
   for(let n=0;n<30;n++){
    const mid=(low+high)/2
    if(chart.getPointAtLength(mid).x<20)low=mid
    else high=mid
   }
   const center=chart.getPointAtLength(high),before=chart.getPointAtLength(high-1),after=chart.getPointAtLength(high+1)
   const turn=Math.abs(Math.atan2(after.y-center.y,after.x-center.x)-Math.atan2(center.y-before.y,center.x-before.x))
   const button=getComputedStyle(document.querySelector(".hero .button")!)
   return {turn,imageWidth:image.width,frameWidth:frame.getBoundingClientRect().width,headerHeight:header.height,badgeLeft:badge.left,badgeRight:badge.right,viewport:innerWidth,background:button.backgroundImage}
  })
  expect(layout.turn).toBeLessThan(.1)
  expect(layout.imageWidth).toBeLessThanOrEqual(layout.frameWidth)
  expect(layout.headerHeight).toBeLessThanOrEqual(108)
  expect(layout.badgeLeft).toBeGreaterThanOrEqual(16)
  expect(layout.badgeRight).toBeLessThanOrEqual(layout.viewport-16)
  expect(layout.background).toContain("rgb(147, 184, 239)")
  expect(layout.background).toContain("rgb(77, 148, 251)")
  for(const text of ["Privacy","Terms"]){
   const label=page.locator("footer").getByText(text,{exact:true})
   const appearance=()=>label.evaluate(element=>{
    const style=getComputedStyle(element)
    return {tag:element.tagName,tabIndex:element.tabIndex,role:element.getAttribute("role"),href:element.getAttribute("href"),cursor:style.cursor,color:style.color,decoration:style.textDecorationLine,font:style.font}
   })
   const normal=await appearance()
   expect(normal.tag).toBe("SPAN")
   expect(normal.tabIndex).toBe(-1)
   expect(normal.role).toBeNull()
   expect(normal.href).toBeNull()
   expect(normal.cursor).not.toBe("pointer")
   expect(normal.decoration).toBe("none")
   await label.hover()
   expect(await appearance()).toEqual(normal)
   await label.evaluate(element=>element.focus())
   expect(await label.evaluate(element=>document.activeElement===element)).toBe(false)
  }
 }finally{await browser.close();await server.close()}
})


it("keeps the CTA gradient on hover on landing and pricing",async()=>{
 const server=await createServer({root:"apps/site",configFile:"apps/site/vite.config.ts",server:{host:"127.0.0.1",port:0},optimizeDeps:{noDiscovery:true,include:[]}})
 await server.listen()
 const browser=await chromium.launch()
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const url=server.resolvedUrls?.local[0]
  if(!url)throw new Error("Site server has no local URL")
  for(const path of ["/","/pricing/"]){
   await page.goto(new URL(path,url).href)
   const button=page.locator("main .button").first()
   const background=()=>button.evaluate(element=>getComputedStyle(element).backgroundImage)
   const resting=await background()
   expect(resting).toContain("linear-gradient")
   await button.hover()
   expect(await background()).toBe(resting)
  }
 }finally{await browser.close();await server.close()}
})
