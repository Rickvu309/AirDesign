import assert from "node:assert/strict"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {mkdir,writeFile,rm} from "node:fs/promises"
import os from "node:os"
import {chromium,expect} from "playwright/test"
import {localStack,signIn} from "../sync/local-stack.mjs"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"

const exec=promisify(execFile),output=process.env.P06_OUTPUT ?? `${os.homedir()}/tmp/airdesign-autopilot/P06`,folder=`${os.homedir()}/tmp/p06-video-${process.pid}`,head=(await exec("git",["rev-parse","HEAD"])).stdout.trim()
await mkdir(`${output}/review`,{recursive:true})
const stack=await localStack(),browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:folder,size:{width:1440,height:1000}}})
async function call(path,data){const response=await context.request.post(stack.origin+path,{headers:{origin:stack.origin},data});assert.ok(response.ok(),await response.text());return response.json()}
async function worker(){await exec(process.execPath,["apps/worker/src/main.ts","images"],{env:{...process.env,AIRDESIGN_DATABASE_URL:stack.url,AIRDESIGN_OPERATIONS_PATH:stack.operationsPath,AIRDESIGN_WORKER_TEMP:`${folder}/jobs`},timeout:120000})}
const page=await context.newPage(),video=page.video()
async function hold(){await page.evaluate(()=>new Promise(resolve=>{let remaining=45;function frame(){if(--remaining)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)}))}
try{
  await signIn(context,stack.origin,"p06-video@example.com")
  const entry=await call("/api/catalog",{requestId:crypto.randomUUID(),title:"A look and an owned image",pendingRequest:""}),deck=fixtureDeck(2,1)
  await call(`/api/decks/${entry.id}/commands`,{id:crypto.randomUUID(),kind:"edit",base:0,run:null,changes:{changes:deck.slides.map((value,index)=>({kind:"insert",parent:entry.id,index,value}))}})
  await page.goto(stack.origin+`/deck/${entry.id}`);await page.locator('[data-sync-state="saved"]').waitFor();await page.evaluate(()=>document.fonts.ready);await hold()
  await page.getByRole("button",{name:"Design",exact:true}).click();await page.getByRole("button",{name:"Choose template",exact:true}).click();await hold();await page.getByRole("button",{name:/Dark slides · v1/}).click();await page.getByRole("button",{name:"Apply to deck",exact:true}).click();await expect(page.getByText("Look applied in one undo step.",{exact:true})).toBeVisible();await hold()
  await page.getByRole("button",{name:"Close design",exact:true}).click();await page.getByRole("button",{name:"Images",exact:true}).click();await page.getByLabel("Image source").selectOption("local-stock");await page.getByRole("button",{name:"Search",exact:true}).click();await hold();await page.locator(".provider-results button").first().click();await expect(page.getByText("Checking your image…",{exact:true})).toBeVisible();await worker();await expect(page.getByText(/Image added ·/)).toBeVisible();await page.getByLabel("Image source").selectOption("library");await hold();await page.getByRole("button",{name:/Place stock image/}).click();await expect(page.getByText("Crop, focus and alt text",{exact:true})).toBeVisible();await page.getByLabel("Crop zoom",{exact:true}).fill("2");await page.getByLabel("Focus horizontal",{exact:true}).fill("0.35");await page.getByLabel("Mask",{exact:true}).selectOption("ellipse");await page.getByLabel("Alt text",{exact:true}).fill("Earth, photographed by NASA");await hold();await page.getByRole("button",{name:"Save image settings",exact:true}).click();await expect(page.getByText(/Image settings saved/)).toBeVisible();await hold()
  await page.getByLabel("Upload image",{exact:true}).setInputFiles({name:"unsafe.svg",mimeType:"image/svg+xml",buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')});await expect(page.getByText("Checking your image…",{exact:true})).toBeVisible();await worker();await expect(page.getByRole("alert")).toBeVisible();await hold();await hold()
  const snapshot=await context.request.get(`${stack.origin}/api/decks/${entry.id}`),value=await snapshot.json();assert.equal(value.deck.template.id,"dark");const picture=value.deck.slides[0].elements.find(element=>element.kind==="image");assert.equal(picture.image.mask,"ellipse");assert.equal(picture.image.alt,"Earth, photographed by NASA")
  await context.close();await video.saveAs(`${output}/review/templates-images.webm`);await writeFile(`${output}/review/video.json`,JSON.stringify({head,verdict:"pass",script:"bench/templates-images/video.mjs",failurePath:"isolated validator refuses scripted SVG",pin:value.deck.template,placement:picture.image},null,2))
}finally{await context.close();await browser.close();await stack.close();await rm(folder,{recursive:true,force:true})}
