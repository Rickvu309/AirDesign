import {readFile,readdir} from "node:fs/promises"
import {createElement} from "react"
import {renderToStaticMarkup} from "react-dom/server"
import {Window} from "happy-dom"
import {chromium} from "playwright"
import {expect,it,vi} from "vitest"
import {Workspace} from "../../apps/studio/src/decks/workspace.tsx"

it("resolves every live New deck locator against the rendered Studio workspace",async()=>{
  const source=await readFile("scripts/live/verify-live.mjs","utf8")
  const names=[...source.matchAll(/getByRole\("button",\{name:"([^"\n]*New deck)",exact:true\}\)/g)].map(match=>match[1])
  expect(names).toHaveLength(4)
  const window=new Window({url:"http://localhost/"})
  vi.stubGlobal("window",window)
  const browser=await chromium.launch({headless:true,executablePath:process.env.AIRDESIGN_CHROME_PATH || undefined})
  try{
    const page=await browser.newPage()
    await page.setContent(renderToStaticMarkup(createElement(Workspace)))
    for(const name of names)await expect.poll(()=>page.getByRole("button",{name,exact:true}).count()).toBe(1)
    await page.getByRole("button",{name:names[0]!,exact:true}).click()
    const menu=page.locator("details").filter({has:page.getByRole("button",{name:names[0]!,exact:true})})
    await expect.poll(()=>menu.getByRole("button",{name:"Import PowerPoint",exact:true}).isVisible()).toBe(true)
    await expect.poll(()=>menu.getByRole("button",{name:"Blank deck",exact:true}).isVisible()).toBe(true)
  }finally{await browser.close();vi.unstubAllGlobals();await window.happyDOM.close()}
},30000)

it("finds every literal exact verifier control name in the built Studio",async()=>{
  const source=await readFile("scripts/live/verify-live.mjs","utf8")
  const names=[...source.matchAll(/getByRole\("[^"\n]+",\{name:"([^"\n]+)",exact:true\}\)|getByLabel\("([^"\n]+)",\{exact:true\}\)/g)].map(match=>match[1] ?? match[2]!)
  expect(names.length).toBeGreaterThan(15)
  const directory="apps/studio/dist/assets"
  const files=(await readdir(directory)).filter(file=>file.endsWith(".js"))
  expect(files.length).toBeGreaterThan(0)
  const built=(await Promise.all(files.map(file=>readFile(`${directory}/${file}`,"utf8")))).join("\n")
  for(const name of names)expect(built.includes(name),`Studio no longer contains verifier control: ${name}`).toBe(true)
})
