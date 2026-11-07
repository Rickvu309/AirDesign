import assert from "node:assert/strict"
import {mkdir,writeFile,copyFile,readFile} from "node:fs/promises"
import {createHash} from "node:crypto"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import sharp from "sharp"
import {scenario,head} from "../agent-account/fixture.mjs"
import {investorDeck} from "./site-investor-deck.ts"

const directory=process.env.SITE_CAPTURE_EVIDENCE ?? path.join(os.homedir(),"tmp/airdesign-polish/site2/capture")
await mkdir(directory,{recursive:true})
const previous=process.env.NODE_ENV
process.env.NODE_ENV="test"
const stack=await scenario({browserEnabled:true})
let browser,hold
try{
 const owner=await stack.fixture.signIn("site-capture@halden.example")
 const deck=investorDeck("site_investor_capture")
 await stack.request(owner,"/api/templates",{id:"halden",version:1,name:"Halden",font:"Geist",background:"#ffffff",foreground:"#102633",accent:"#1e6f8c",fontRight:"installed",families:[{id:"basic",name:"Basic",master:null,layouts:["Blank"]}]},201)
 await stack.request(owner,"/api/decks",deck,201)
 await stack.request(owner,`/api/catalog/${deck.id}/rename`,{title:"Q3 Investor Update"})
 browser=await chromium.launch()
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2})
 await context.addCookies(owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:stack.origin}}))
 const page=await context.newPage()
 await page.goto(stack.origin+`/deck/${deck.id}`)
 await page.waitForFunction(()=>document.querySelector(".studio-editor")?.textContent.includes("Saved"))
 await page.getByRole("button",{name:"Slide 3",exact:true}).dblclick()
 await page.getByRole("button",{name:"Agent",exact:true}).click()
 hold=stack.hold()
 const source=await stack.stream(owner,deck.id)
 await stack.request(owner,`/api/aira?deck=${deck.id}`,{action:"send",text:"Make an 8-slide investor update from my notes. Calm, data first, our Halden brand.",selection:[]},202)
 for(let index=0;index<2;index++){
  await hold.entered.promise
  const next=stack.hold()
  hold.release.resolve()
  hold=next
 }
 await hold.entered.promise
 await page.locator('.aira-run-status[data-kind="working"]').waitFor()
 const saved=await stack.request(owner,`/api/decks/${deck.id}`)
 assert.equal(stack.commits.length,3)
 assert.equal(saved.deck.slides.length,8)
 await page.evaluate(()=>document.fonts.ready)
 const desktop=path.join(directory,"studio-desktop.png"),mobile=path.join(directory,"studio-mobile.png")
 await page.screenshot({path:desktop})
 const bounds=await page.locator(".editor-slide:not([hidden]) .slide-preview").boundingBox()
 assert.ok(bounds)
 await sharp(desktop).extract({left:Math.round(bounds.x*2),top:Math.round(bounds.y*2),width:Math.min(Math.round(bounds.width*2),2880-Math.round(bounds.x*2)),height:Math.min(Math.round(bounds.height*2),1800-Math.round(bounds.y*2))}).png().toFile(mobile)
 await stack.request(owner,`/api/aira?deck=${deck.id}`,{action:"stop"})
 hold.release.resolve()
 await stack.until(source,value=>value.run?.kind==="stopped")
 const provenance={head,kind:"actual-built-studio",adapter:"deterministic-local",template:"Halden",deck:deck.id,slides:8,acceptedChanges:stack.commits.length,state:"working after the third accepted slide change",viewport:{width:1440,height:900,deviceScaleFactor:2},refresh:"heavy --label site-capture -- node bench/release/site-capture.mjs --publish",fixture:"bench/release/site-investor-deck.ts",fixtureSource:"design-parity/bench/design-parity/investor-deck.ts",fixtureSha256:createHash("sha256").update(await readFile("bench/release/site-investor-deck.ts")).digest("hex"),mobileCrop:bounds,sha256:createHash("sha256").update(await readFile(desktop)).digest("hex")}
 await writeFile(path.join(directory,"provenance.json"),JSON.stringify(provenance,null,2)+"\n")
 if(process.argv.includes("--publish")){
  await copyFile(desktop,"apps/site/public/studio-capture.png")
  await copyFile(mobile,"apps/site/public/studio-capture-mobile.png")
  await writeFile("apps/site/public/studio-capture.json",JSON.stringify(provenance,null,2)+"\n")
 }
 console.log(JSON.stringify({status:"pass",directory,slides:8,acceptedChanges:3}))
}finally{
 hold?.release.resolve()
 await browser?.close()
 await stack.close()
 if(previous===undefined)delete process.env.NODE_ENV
 else process.env.NODE_ENV=previous
}
