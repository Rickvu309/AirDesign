import {createElement} from "react"
import {renderToStaticMarkup} from "react-dom/server"
import {chromium} from "playwright"
import sharp from "sharp"
import {expect,it} from "vitest"
import {Icon} from "../../packages/ui/src/icon/icon.tsx"
import {iconPaths,iconStrokeWidth,isIconName} from "../../packages/ui/src/icon/icon-paths.ts"
import {assertScenarioStructure} from "./dom-assertions.ts"
import {readRegistry,type Scenario} from "./registry.ts"

const names=Object.keys(iconPaths).filter(isIconName)
const markup=(name:keyof typeof iconPaths)=>renderToStaticMarkup(createElement(Icon,{name}))
const content=(svg:string)=>`<style>body{margin:0;background:white}main{position:absolute;left:24px;top:24px;color:#222}svg{display:block}img{position:absolute;left:0;top:0;width:16px;height:16px}</style><main>${svg}</main>`
function entry(original:Scenario,name:string):Scenario{
  return {...original,component:undefined,assertions:{...original.assertions,copyKeys:[],controls:[],structure:{icons:[{region:"main",name,size:16,color:"ink"}],textRoles:[]}}}
}

it("accepts every actual canonical renderer output with exact default and undo/redo strokes",async()=>{
  const original=(await readRegistry()).find(value=>value.code==="S31.02")!
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:200,height:100}})
    for(const name of names){
      const svg=markup(name)
      expect(svg).toContain(`stroke-width="${name==="undo"||name==="redo" ? "1.5" : "1.6"}"`)
      await page.setContent(content(svg))
      await expect(assertScenarioStructure(page,entry(original,name)),name).resolves.toBeUndefined()
    }
  }finally{await browser.close()}
})

it.each(["search","grid","undo","redo"] as const)("rejects independent icon mutations from passing actual %s baselines",async name=>{
  const original=(await readRegistry()).find(value=>value.code==="S31.02")!
  const scenario=entry(original,name),svg=markup(name)
  const raster=await sharp(Buffer.from(svg.replace("<svg ",'<svg xmlns="http://www.w3.org/2000/svg" color="#222" '))).png().toBuffer()
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:200,height:100}})
    for(const [mutation,check] of [["width","icon-size"],["stroke","icon-stroke"],["color","icon-color"],["geometry","icon-geometry"],["missing","required-icon"],["path-opacity","icon-opacity"],["svg-opacity","ink-ownership"],["raster","ink-ownership"]]){
      await page.setContent(content(svg))
      await expect(assertScenarioStructure(page,scenario),`${mutation} baseline`).resolves.toBeUndefined()
      await page.evaluate(({mutation,wrongStroke,raster})=>{
        const svg=document.querySelector("svg")!,part=svg.querySelector("path")!
        if(mutation==="width")svg.setAttribute("width","20")
        if(mutation==="stroke")part.style.strokeWidth=wrongStroke
        if(mutation==="color")part.style.stroke="red"
        if(mutation==="geometry")part.setAttribute("d","M2 2L22 22")
        if(mutation==="missing")svg.remove()
        if(mutation==="path-opacity")part.style.opacity="0"
        if(mutation==="svg-opacity"||mutation==="raster")svg.style.opacity="0"
        if(mutation==="raster"){
          const image=new Image();image.src=`data:image/png;base64,${raster}`;svg.before(image)
          return image.decode()
        }
      },{mutation,wrongStroke:name==="undo"||name==="redo" ? "1.6" : "1.5",raster:raster.toString("base64")})
      await expect(assertScenarioStructure(page,scenario),mutation).rejects.toThrow(check)
    }
  }finally{await browser.close()}
})

it("narrows only own canonical names at the string boundary",()=>{
  for(const name of names)expect(isIconName(name)).toBe(true)
  for(const name of ["unknown-icon","toString","constructor","__proto__"])expect(isIconName(name)).toBe(false)
  expect(iconStrokeWidth("undo")).toBe(1.5)
  expect(iconStrokeWidth("redo")).toBe(1.5)
  expect(iconStrokeWidth("search")).toBe(1.6)
})
