import path from "node:path"
import {build} from "vite"
import {chromium,type Page} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {iconPaths} from "../../packages/ui/src/icon/icon-paths.ts"

let script="",styles=""
beforeAll(async()=>{
  const entry=path.resolve("virtual:shell-starred-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"shell-starred-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement,useState} from "react";import {createRoot} from "react-dom/client";import {StudioShell} from "${path.resolve("apps/studio/src/shell/studio-shell.tsx")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";function Proof(){const [stars,setStars]=useState([{id:"atlas",title:"Project Atlas"},{id:"q3",title:"Q3 Investor Update"},{id:"plan",title:"FY26 Operating Plan"}]);return createElement(StudioShell,{intentLabel:"Home",showIntent:false,onSignOut:()=>{},search:"",onSearch:()=>{},starredDecks:stars},createElement("button",{onClick:()=>setStars([])},"Clear stars"),createElement("button",{onClick:()=>setStars([{id:"long",title:"A very long executive presentation title with meaningful words and "+"unbroken".repeat(20)}])},"Replace stars"))}createRoot(document.getElementById("root")).render(createElement(Proof));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"ShellStarredProof"}}})
  const outputs=Array.isArray(built) ? built : [built]
  const files=outputs.flatMap(output=>"output" in output ? output.output : [])
  script=files.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  styles=files.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css") ? [typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)] : []).join("\n")
})
async function mount(page:Page){
  await page.setContent('<base href="http://studio.test/"><div id="root"></div>')
  await page.addStyleTag({content:styles})
  await page.addScriptTag({content:script})
  await page.getByRole("link",{name:"Project Atlas",exact:true}).waitFor()
  await page.evaluate(()=>document.fonts.ready)
}
async function requirePresentationRows(page:Page){
  const rows=page.locator(".ad-starred a")
  expect(await rows.count()).toBe(3)
  for(const row of await rows.all()){
    const icon=row.locator('svg[data-icon="presentation"]')
    expect(await icon.count()).toBe(1)
    expect(await icon.locator("path").getAttribute("d")).toBe(iconPaths.presentation)
    expect(await icon.evaluate(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height}))).toEqual({width:16,height:16})
  }
}
it("uses the presentation silhouette for real dynamic Starred links",async()=>{
  const browser=await chromium.launch({headless:true})
  try{const page=await browser.newPage({viewport:{width:1470,height:923}});await mount(page);await requirePresentationRows(page);expect(await page.getByRole("link",{name:"Project Atlas",exact:true}).getAttribute("href")).toBe("/deck/atlas");let navigations=0;await page.route("http://studio.test/deck/atlas",route=>{navigations++;return route.fulfill({body:"Deck opened"})});await page.getByRole("link",{name:"Project Atlas",exact:true}).focus();await page.keyboard.press("Enter");await page.waitForURL("http://studio.test/deck/atlas");expect(navigations).toBe(1)}finally{await browser.close()}
})
it("spaces only Starred rows without a section divider and keeps native disclosure",async()=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923}});await mount(page)
    const measured=await page.locator(".ad-starred").evaluate(section=>({border:getComputedStyle(section).borderTopWidth,rows:[...section.querySelectorAll("a")].map(row=>{const box=row.getBoundingClientRect();return {x:box.x,y:box.y,height:box.height,gap:getComputedStyle(row).columnGap}})}))
    console.log("STARRED_MEASUREMENTS",JSON.stringify(measured))
    expect(measured.border).toBe("0px")
    expect(measured.rows.map(row=>row.height)).toEqual([34,34,34])
    expect(measured.rows.map(row=>row.gap)).toEqual(["8px","8px","8px"])
    const summary=page.locator(".ad-starred summary")
    await summary.focus();await page.keyboard.press("Enter")
    expect(await page.locator(".ad-starred").getAttribute("open")).toBeNull()
    expect(await page.getByRole("link",{name:"Project Atlas",exact:true}).isVisible()).toBe(false)
    await page.keyboard.press("Space")
    expect(await page.getByRole("link",{name:"Project Atlas",exact:true}).isVisible()).toBe(true)
    await page.keyboard.press("Tab")
    expect(await page.getByRole("link",{name:"Project Atlas",exact:true}).evaluate(element=>({focused:element===document.activeElement,outline:getComputedStyle(element).outlineStyle}))).toEqual({focused:true,outline:"solid"})
    await page.getByRole("button",{name:"Replace stars",exact:true}).click()
    const row=page.locator(".ad-starred a");await row.waitFor()
    expect(await row.getAttribute("href")).toBe("/deck/long")
    expect(await row.evaluate(element=>({fits:element.scrollWidth<=element.clientWidth,lines:element.getBoundingClientRect().height>34,icon:element.querySelector("svg")?.getBoundingClientRect().width}))).toEqual({fits:true,lines:true,icon:16})
    await page.getByRole("button",{name:"Clear stars",exact:true}).click()
    expect(await page.locator(".ad-starred a").count()).toBe(0)
    expect(await page.locator(".ad-starred p").innerText()).not.toBe("")
  }finally{await browser.close()}
})
it.each(["missing","wrong"])("rejects a %s presentation control from the passing real Shell baseline",async state=>{
  const browser=await chromium.launch({headless:true})
  try{const page=await browser.newPage({viewport:{width:1470,height:923}});await mount(page);await requirePresentationRows(page);const icon=page.locator(".ad-starred a svg").first();if(state==="missing")await icon.evaluate(element=>element.remove());else await icon.evaluate(element=>element.setAttribute("data-icon","decks"));await expect(requirePresentationRows(page)).rejects.toThrow()}finally{await browser.close()}
})
