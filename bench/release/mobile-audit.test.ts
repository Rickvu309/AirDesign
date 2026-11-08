import {afterAll,beforeAll,describe,expect,it} from "vitest"
import {readFile} from "node:fs/promises"
import {chromium,type Browser,type Page} from "playwright"
import {mobileAuditFailures} from "./mobile-audit-checks.ts"

let browser:Browser
let page:Page
beforeAll(async()=>{
 browser=await chromium.launch()
 page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3})
})
afterAll(async()=>{await browser?.close()})
const base="body{margin:0;padding:60px}button{border:0;padding:0;position:relative;width:44px;height:44px;touch-action:manipulation}input{font-size:16px}"
async function audit(css:string,html:string){
 await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${base}${css}</style>${html}`)
 return page.evaluate(mobileAuditFailures,390)
}
describe("mobile browser audit",()=>{
 it("rejects the specificity override that source lint cannot resolve",async()=>{
  const hits=await audit(".editor input{font-size:14px}@media(pointer:coarse){input{font-size:16px}}",'<div class="editor"><input></div>')
  expect(hits.some(hit=>hit.startsWith("small input:"))).toBe(true)
 })
 it("accepts one rem at the default root size",async()=>{
  expect(await audit("input{font-size:1rem}","<input>")).toEqual([])
 })
 it.each([
  ["pointer events disabled", "button::before{pointer-events:none}"],
  ["clipped", ".clip{width:30px;height:30px;overflow:hidden}"],
  ["overlapping", ".cover{position:absolute;left:50px;top:50px;width:8px;height:44px;z-index:2}"],
 ])("rejects fake hit areas: %s",async(_name,css)=>{
  const hits=await audit('button{width:30px;height:30px}button::before{content:"";position:absolute;inset:-7px}'+css,'<div class="clip"><button>X</button></div><div class="cover"></div>')
  expect(hits.some(hit=>hit.startsWith("small target:"))).toBe(true)
 })
 it("keeps the shared rounded controls tappable across the central square",async()=>{
  const tokens=await readFile(new URL("../../packages/ui/src/tokens/tokens.css",import.meta.url),"utf8")
  expect(await audit(tokens+"button{width:51px;border-radius:999px}","<button>List</button>")).toEqual([])
 })
 it("accepts a working expanded hit area",async()=>{
  expect(await audit('button{width:30px;height:30px}button::before{content:"";position:absolute;inset:-7px}',"<button>X</button>")).toEqual([])
 })
 it("keeps auditing the background of a nonmodal dialog",async()=>{
  const hits=await audit(".small{width:30px;height:30px}",'<button class="small">Background</button><dialog open>Details</dialog>')
  expect(hits.some(hit=>hit.startsWith("small target: Background"))).toBe(true)
 })
 it("audits the active modal without counting its inert background",async()=>{
  await audit(".small{width:30px;height:30px}",'<button class="small">Background</button><dialog><button>Modal</button></dialog>')
  await page.locator("dialog").evaluate(dialog=>{
   if(dialog instanceof HTMLDialogElement)dialog.showModal()
  })
  expect(await page.evaluate(mobileAuditFailures,390)).toEqual([])
 })
 it("keeps wrapped paragraph links from stealing adjacent hit areas",async()=>{
  const tokens=await readFile(new URL("../../packages/ui/src/tokens/tokens.css",import.meta.url),"utf8")
  expect(await audit(tokens+"p{margin:0;width:270px;transform:translateY(.203125px)}a{width:130px}",'<p><a href="#before">Before</a> <a href="#after">After</a> <a href="#provenance">Provenance</a></p>')).toEqual([])
 })
 it.each(["div","span","article","p"])("rejects unselectable %s content",async tag=>{
  const hits=await audit(".content{user-select:none}",`<${tag} class="content">Readable content</${tag}>`)
  expect(hits.some(hit=>hit.startsWith("unselectable content:"))).toBe(true)
 })
 it("accepts unselectable text within controls and selectable content",async()=>{
  expect(await audit("button{user-select:none}","<button><span>Go</span></button><div>Readable content</div>")).toEqual([])
 })
})

it("restores every scroll position when target measurement throws",async()=>{
 await page.setContent(`<style>body{margin:0;height:1800px}.scroll{height:100px;overflow:auto}.space{height:600px}button{width:44px;height:44px;touch-action:manipulation}</style><div class="scroll"><div class="space"></div><button>Target</button></div>`)
 const before=await page.evaluate(()=>({x:scrollX,y:scrollY,containers:[...document.querySelectorAll("*")].map(element=>({top:element.scrollTop,left:element.scrollLeft}))}))
 const original=await page.evaluateHandle(()=>Element.prototype.scrollIntoView)
 try{
  await page.evaluate(()=>{const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){original.call(this,options);throw new Error("forced-target-measurement")}})
  await expect(page.evaluate(mobileAuditFailures,390)).rejects.toThrow("forced-target-measurement")
  expect(await page.evaluate(()=>({x:scrollX,y:scrollY,containers:[...document.querySelectorAll("*")].map(element=>({top:element.scrollTop,left:element.scrollLeft}))}))).toEqual(before)
 }finally{await page.evaluate(original=>{Element.prototype.scrollIntoView=original},original);await original.dispose()}
})

it("uses browser disclosure visibility while retaining visible overflow and target failures",async()=>{
 expect(await audit("summary{height:44px;touch-action:manipulation}.small{width:20px;height:20px}",'<details><summary>Account</summary><button class="small">Hidden action</button></details>')).toEqual([])
 const open=await audit("summary{height:44px;touch-action:manipulation}.small{width:20px;height:20px}",'<details open><summary>Account</summary><button class="small">Visible action</button></details>')
 expect(open.some(hit=>hit.startsWith("small target: Visible action"))).toBe(true)
 const overflow=await audit(".wide{width:500px}",'<div class="wide">Visible overflow</div>')
 expect(overflow.some(hit=>hit.startsWith("horizontal overflow:"))).toBe(true)
})
