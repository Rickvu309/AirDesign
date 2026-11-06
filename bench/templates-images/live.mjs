import assert from "node:assert/strict"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {mkdir,writeFile,readFile,rm} from "node:fs/promises"
import os from "node:os"
import {chromium,expect} from "playwright/test"
import sharp from "sharp"
import {localStack,signIn,freePort} from "../sync/local-stack.mjs"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {basics,newerVersion} from "../../packages/brand/src/index.ts"
import {createNativePresentation} from "../../packages/pptx/src/native.ts"
import {readArchive,writeArchive} from "../../packages/pptx/src/archive.ts"
import {importPptx,hash} from "../../packages/pptx/src/index.ts"
import {runPerformance} from "./performance.mjs"

const exec=promisify(execFile),output=process.env.P06_OUTPUT ?? `${os.homedir()}/tmp/airdesign-autopilot/P06`,head=(await exec("git",["rev-parse","HEAD"])).stdout.trim(),trace=[]
await mkdir(output,{recursive:true})
const stack=await localStack(),cdp=await freePort(),profile=`${os.homedir()}/tmp/p06-chrome-${process.pid}`
const context=await chromium.launchPersistentContext(profile,{headless:true,args:[`--remote-debugging-port=${cdp}`],viewport:{width:1440,height:1000}})
let lane=1
const account=await signIn(context,stack.origin,"p06-owner@example.com"),other=await context.browser().newContext()
await signIn(other,stack.origin,"p06-other@example.com")
const request=context.request
async function call(path,data,method=data===undefined ? "GET" : "POST",status=200,client=request){const response=await client.fetch(stack.origin+path,{method,headers:{origin:stack.origin,"content-type":"application/json"},...(data===undefined ? {} : {data})}),value=await response.json();trace.push({lane,path,method,status:response.status(),value});assert.equal(response.status(),status,JSON.stringify(value));return value}
async function worker(mode="all"){const result=await exec(process.execPath,["apps/worker/src/main.ts",mode],{env:{...process.env,AIRDESIGN_DATABASE_URL:stack.url,AIRDESIGN_OPERATIONS_PATH:stack.operationsPath,AIRDESIGN_WORKER_TEMP:`${profile}/jobs`},timeout:120000,maxBuffer:1000000});trace.push({lane,worker:result.stdout,stderr:result.stderr});return result}
async function receipt(values){const folder=`${output}/lane-${lane}`;await mkdir(folder,{recursive:true});await writeFile(`${folder}/receipt.json`,JSON.stringify({head,lane,verdict:"pass",...values},null,2));await writeFile(`${folder}/trace.json`,JSON.stringify(trace.filter(item=>item.lane===lane),null,2));await writeFile(`${folder}/terminal.txt`,JSON.stringify({head,lane,...values},null,2))}
const uid=()=>crypto.randomUUID()
async function create(name="Templates and images"){return call("/api/catalog",{requestId:uid(),title:name,pendingRequest:""},"POST",201)}
async function snapshot(deck){return call(`/api/decks/${deck}`)}
async function edit(deck,changes){const current=await snapshot(deck);return call(`/api/decks/${deck}/commands`,{id:uid(),kind:"edit",base:current.seq,run:null,changes:{changes}})}
async function apply(deck,id="dark",version=1,extra={}){return call("/api/templates/apply",{deck,id,version,requestId:uid(),mode:"apply-deck",family:"basic",...extra})}
async function ingest(bytes){const job=await call("/api/assets/ingest",{base64:bytes.toString("base64"),requestId:uid()},"POST",202);await worker("images");const status=await call(`/api/assets/jobs/${job.id}`);assert.equal(status.kind,"ready",JSON.stringify(status));return call(`/api/assets/jobs/${job.id}/adopt`,{})}
async function place(deck,asset,id,extra={}){return call("/api/assets/place",{deck,asset,elementId:id,slide:"s0",requestId:uid(),...extra})}
async function exportDeck(deck,name){const current=await snapshot(deck),job=await call(`/api/catalog/${deck}/exports`,{requestId:uid(),format:"pptx",slides:current.deck.slides.map(slide=>slide.id),timing:"now",expectedSeq:current.seq,allowIssues:true},"POST",202);await worker();const ready=await call(`/api/catalog/export-jobs/${job.id}`);assert.equal(ready.kind,"ready",JSON.stringify(ready));const response=await request.get(`${stack.origin}/api/catalog/export-jobs/${job.id}/artifact`);assert.equal(response.status(),200);const bytes=await response.body();await writeFile(`${output}/${name}`,bytes);await call(`/api/catalog/export-jobs/${job.id}`,undefined,"GET",400,other.request);return {bytes,job:ready}}
let page=context.pages()[0] ?? await context.newPage()
async function shot(name){await page.evaluate(()=>document.fonts.ready);for(const width of [1440,320]){await page.setViewportSize({width,height:1000});const target=name==="image-refusal"||name==="image-storage-full" ? page.getByRole("alert") : name==="image-no-results" ? page.getByText(/No images found for/) : name==="image-low-resolution" ? page.getByText(/This image may look blurry/) : name==="image-crop-focus-alt" ? page.getByRole("textbox",{name:/^Alt text/}) : null;if(target)await target.scrollIntoViewIfNeeded();const bounds=await page.locator(".template-picker,.template-panel,.image-panel").evaluateAll(panels=>panels.map(panel=>({name:panel.getAttribute("aria-label"),left:panel.getBoundingClientRect().left,right:panel.getBoundingClientRect().right,scroll:panel.scrollWidth,width:panel.clientWidth})));for(const panel of bounds){assert.ok(panel.left>=0&&panel.right<=width+1,JSON.stringify({width,panel}));assert.ok(panel.scroll<=panel.width+1,JSON.stringify({width,panel}))}const file=`${output}/review/${name}-${width}.png`;await exec("agent-browser",["--session","p06","--cdp",String(cdp),"screenshot",file],{timeout:30000,maxBuffer:10000})}await page.setViewportSize({width:1440,height:1000})}
try{
  await mkdir(`${output}/review`,{recursive:true})
  const trunk=(await exec("git",["show","9bfe9a4:apps/studio/src/editor/manual-editor.tsx"])).stdout
  assert.match(trunk,/Design/);assert.doesNotMatch(trunk,/TemplatePanel|ImagePanel/)
  const entry=await create(),deck=entry.id,fixture=fixtureDeck(3,2)
  for(const slide of fixture.slides){slide.elements[0].theme="default";slide.elements[0].styleLinks=["font"];slide.elements[1].theme="default"}
  await edit(deck,fixture.slides.map((value,index)=>({kind:"insert",parent:deck,index,value})))
  const applied=await apply(deck),dark=await snapshot(deck);assert.equal(dark.deck.template.id,"dark")
  const provider=await call("/api/assets/search?provider=local-stock&q="),stock=provider.items[0]
  const stockJob=await call("/api/assets/provider",{provider:"local-stock",item:stock.id,requestId:uid()},"POST",202);await worker("images");const asset=await call(`/api/assets/jobs/${stockJob.id}/adopt`,{})
  await place(deck,asset.id,"pictureA");const reuse=await create("Reused owned image");await edit(reuse.id,[{kind:"insert",parent:reuse.id,index:0,value:{...fixture.slides[0],elements:[]}}]);await place(reuse.id,asset.id,"reusedPicture");assert.equal((await snapshot(reuse.id)).deck.slides[0].elements[0].image.asset,asset.id);const undoLook=uid(),beforeLook=await snapshot(reuse.id);await apply(reuse.id,"dark",1,{requestId:undoLook});await call(`/api/decks/${reuse.id}/commands`,{id:uid(),kind:"undo",target:undoLook});assert.deepEqual((await snapshot(reuse.id)).deck.template,beforeLook.deck.template)
  const firstExport=await exportDeck(deck,"template-image.pptx");assert.ok((await importPptx(firstExport.bytes)).report.relationships.some(rel=>rel.type.endsWith("/image")))
  await writeFile(`${output}/lane-1/comparison.json`,JSON.stringify({head,base:"9bfe9a4",trunk:"missing",proof:"Design and Images disabled; no panel imports",result:"applied template and reused owned image in two decks",decks:[deck,reuse.id],asset:asset.id},null,2));await receipt({reusedIn:[deck,reuse.id],baseline:"Trunk has disabled Design and Images, no comparable product operations",template:dark.deck.template,asset,export:firstExport.job,retained:applied.retained})

  lane=2
  assert.equal(dark.deck.slides[0].elements[0].runs[0].color,fixture.slides[0].elements[0].runs[0].color)
  assert.equal(dark.deck.slides[0].elements[1].fill,basics[1].accent)
  assert.ok(applied.retained.includes("s0e0.color"))
  const bytes=await readFile("packages/files/src/assets/bundled/stock/blue-marble.jpg"),jobs=await Promise.all([call("/api/assets/ingest",{base64:bytes.toString("base64"),requestId:uid()},"POST",202),call("/api/assets/ingest",{base64:bytes.toString("base64"),requestId:uid()},"POST",202)])
  await worker();const adopts=await Promise.all(jobs.map(job=>call(`/api/assets/jobs/${job.id}/adopt`,{})));assert.equal(adopts[0].id,asset.id);assert.equal(adopts[1].id,asset.id)
  await place(deck,asset.id,"pictureB");assert.equal((await call("/api/assets")).assets.length,1)
  await call(`/api/assets/${asset.id}/original`,undefined,"GET",404,other.request)
  const concurrentId=uid(),prior=(await snapshot(deck)).seq;await call(`/api/decks/${deck}/commands`,{id:uid(),kind:"start-run",run:"agent"});const concurrent=await Promise.all([apply(deck,"dark",1,{requestId:concurrentId}),apply(deck,"dark",1,{requestId:concurrentId})]);assert.deepEqual(concurrent[0].receipt,concurrent[1].receipt);assert.equal((await snapshot(deck)).seq,prior+2);await call(`/api/decks/${deck}/commands`,{id:uid(),kind:"close-run",run:"agent"});await receipt({concurrent:concurrent.map(value=>value.receipt),localColor:dark.deck.slides[0].elements[0].runs[0].color,linkedFill:dark.deck.slides[0].elements[1].fill,retained:applied.retained,dedupedHash:adopts.map(item=>item.id),placements:2})

  lane=3
  const imported=await createNativePresentation([{title:"Two master families",table:{headers:["A"],rows:[["1"]]},chart:{name:"Sales",labels:["A"],values:[1]},notes:"Preserved"}]),parts=new Map(imported.parts),master="ppt/slideMasters/slideMaster1.xml",layout="ppt/slideLayouts/slideLayout1.xml"
  parts.set("ppt/slideMasters/slideMaster2.xml",parts.get(master));parts.set("ppt/slideMasters/_rels/slideMaster2.xml.rels",parts.get("ppt/slideMasters/_rels/slideMaster1.xml.rels"));parts.set("ppt/slideLayouts/slideLayout2.xml",parts.get(layout));parts.set("ppt/slideLayouts/_rels/slideLayout2.xml.rels",Buffer.from(parts.get("ppt/slideLayouts/_rels/slideLayout1.xml.rels").toString().replaceAll("slideMaster1.xml","slideMaster2.xml")))
  parts.set("[Content_Types].xml",Buffer.from(parts.get("[Content_Types].xml").toString().replace("</Types>",'<Override PartName="/ppt/slideMasters/slideMaster2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/></Types>')))
  const source=await writeArchive(parts),operation=await call("/api/operations",{base64:source.toString("base64"),requestId:uid()},"POST",202);await worker()
  const importedEntry=await call("/api/catalog/import",{operation:operation.id,title:"Multiple master source",requestId:uid()},"POST",201),template=await call("/api/templates/from-deck",{id:"consulting",version:1,name:"Consulting",deck:importedEntry.entry.id},"POST",201)
  assert.equal(template.families.length,2)
  await apply(deck,template.id,1,{family:template.families[1].id,substitution:"Geist"})
  const original=await request.get(`${stack.origin}/api/assets/${asset.id}/original`),originalHash=hash(await original.body()),crop={x:.2,y:.1,width:.5,height:.6},focal={x:.45,y:.4}
  await call("/api/assets/update",{deck,asset:asset.id,elementId:"pictureA",crop,focal,mask:"rectangle",alt:"Earth from space",requestId:uid()})
  const cropped=await snapshot(deck),pictures=cropped.deck.slides[0].elements.filter(element=>element.kind==="image")
  assert.deepEqual(pictures[0].image.crop,crop);assert.equal(pictures[1].image.crop.width,1)
  assert.equal(hash(await (await request.get(`${stack.origin}/api/assets/${asset.id}/original`)).body()),originalHash)
  const masterExport=await exportDeck(deck,"multiple-masters-image.pptx"),graph=await importPptx(masterExport.bytes),archive=await readArchive(masterExport.bytes)
  assert.equal(graph.report.relationships.find(rel=>rel.part==="ppt/slides/slide1.xml"&&rel.type.endsWith("/slideLayout")).target,"airdesign-template/consulting-v1/ppt/slideLayouts/slideLayout2.xml")
  assert.deepEqual(archive.get("airdesign-template/consulting-v1/"+master),parts.get(master));assert.deepEqual(archive.get("airdesign-template/consulting-v1/ppt/slideMasters/slideMaster2.xml"),parts.get("ppt/slideMasters/slideMaster2.xml"))
  const lo=`${output}/lane-3/libreoffice`;await mkdir(lo,{recursive:true});const loCommand=`${os.homedir()}/tmp/tools/libreoffice/soffice-local`,loArgs=[`-env:UserInstallation=file://${profile}/lo`,"--headless","--convert-to","pdf","--outdir",lo,`${output}/multiple-masters-image.pptx`];const reopen=await exec(loCommand,loArgs,{timeout:120000,maxBuffer:10000}).catch(error=>{if(error.code!==81)throw error;return exec(loCommand,loArgs,{timeout:120000,maxBuffer:10000})});assert.ok((await readFile(`${lo}/multiple-masters-image.pdf`)).length>1000)
  await mkdir(`${os.homedir()}/tmp/airdesign-autopilot/P03/P03R`,{recursive:true});await writeFile(`${os.homedir()}/tmp/airdesign-autopilot/P03/P03R/p06-template-images.pptx`,masterExport.bytes)
  await receipt({families:template.families,selected:template.families[1],originalHash,pictures:pictures.map(value=>value.image),relationships:graph.report.relationships,libreoffice:reopen.stdout,windowsMac:"Pending P09 X01; no fidelity claim"})

  lane=4
  const missing={...basics[0],id:"missingFont",name:"Missing font example",font:"Unavailable Font",fontRight:"missing"};await call("/api/templates",missing,"POST",201)
  await call("/api/templates/apply",{deck,id:missing.id,version:1,mode:"apply-deck",family:"basic",requestId:uid()},"POST",400)
  await apply(deck,missing.id,1,{substitution:"Geist"});assert.equal((await snapshot(deck)).deck.themes.find(theme=>theme.id===missing.id).font,"Geist")
  await call("/api/assets/update",{deck,asset:asset.id,elementId:"pictureA",crop,focal,mask:"ellipse",alt:"Earth from space",requestId:uid()})
  const maskExport=await exportDeck(deck,"mask-alt.pptx"),maskParts=await readArchive(maskExport.bytes),xml=maskParts.get("ppt/slides/slide1.xml").toString();assert.match(xml,/prst="ellipse"/);assert.match(xml,/l="20000" t="10000" r="30000" b="30000"/)
  const maskGraph=await importPptx(maskExport.bytes),picturePart=maskGraph.report.relationships.find(rel=>rel.part==="ppt/slides/slide1.xml"&&rel.type.endsWith("/image"))?.target;assert.ok(picturePart)
  const nativePicture=maskParts.get(picturePart);assert.ok(nativePicture);assert.equal((await sharp(nativePicture).metadata()).width,asset.width);assert.equal(hash(nativePicture),originalHash)
  await receipt({missingFont:missing.font,explicitSubstitution:"Geist",mask:"ellipse",crop,sourceWidth:asset.width})

  lane=5
  const restricted={...basics[0],id:"restrictedFont",name:"No embedding example",fontRight:"no-embedding"};await call("/api/templates",restricted,"POST",201);const warning=await apply(deck,restricted.id);assert.match(warning.warnings[0],/cannot be embedded/)
  const restrictedExport=await exportDeck(deck,"no-embedding.pptx"),restrictedParts=await readArchive(restrictedExport.bytes);assert.match(restrictedParts.get("ppt/slides/slide1.xml").toString(),/descr="Earth from space"/);assert.ok(![...restrictedParts.keys()].some(name=>name.includes("font")&&name.endsWith(".odttf")))
  await receipt({warnings:warning.warnings,alt:(await snapshot(deck)).deck.slides[0].elements.find(element=>element.id==="pictureA").image.alt,exportAlt:true,embeddedFonts:0})

  lane=6
  await apply(deck,"dark");const saved=await call("/api/templates/from-deck",{id:"personal",name:"Personal version",deck},"POST",201);assert.equal(saved.background,basics[1].background);assert.equal(saved.foreground,basics[1].foreground);await call("/api/templates",{...saved,name:"Overwritten"},"POST",400);await call("/api/templates/apply",{deck,id:saved.id,version:1,mode:"apply-deck",family:"basic",requestId:uid()},"POST",404,other.request)
  const invalid=['<script>alert(1)</script>','<image href="https://example.com/a.png"/>'];const refused=[]
  for(const content of invalid){const job=await call("/api/assets/ingest",{base64:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${content}</svg>`).toString("base64"),requestId:uid()},"POST",202);await worker("images");const status=await call(`/api/assets/jobs/${job.id}`);assert.equal(status.kind,"failed");refused.push(status)}
  await receipt({saved,immutable:true,crossOwnerRefused:true,isolatedRefusals:refused})

  lane=7
  const oldPin=(await snapshot(deck)).deck.template;await call("/api/templates/default",{id:"dark",version:1});const next=await create("Default Dark"),nextDeck=await snapshot(next.id);assert.equal(nextDeck.deck.template.id,"dark");assert.deepEqual((await snapshot(deck)).deck.template,oldPin)
  const phone=await sharp({create:{width:6000,height:2000,channels:3,background:"blue"}}).jpeg().withMetadata({orientation:6}).toBuffer(),photo=await ingest(phone);assert.deepEqual([photo.width,photo.height],[1365,4096]);const photoOriginal=await request.get(`${stack.origin}/api/assets/${photo.id}/original`);assert.equal(hash(await photoOriginal.body()),hash(phone))
  await receipt({default:nextDeck.deck.template,existing:oldPin,photo,originalBytes:phone.length,orientationNormalized:true})

  lane=8
  await apply(deck,saved.id);await call("/api/templates",{...saved,version:2,name:"Personal revised"},"POST",201)
  const versions=await call("/api/templates"),pin=(await snapshot(deck)).deck.template;assert.equal(newerVersion((await snapshot(deck)).deck,versions.templates).version,2);assert.equal(pin.version,1)
  const query="no-result-01234",empty=await call(`/api/assets/search?provider=local-stock&q=${query}`);assert.equal(empty.items.length,0)
  await receipt({pinned:pin,offeredVersion:2,query,noResults:empty})

  lane=9
  const before=(await snapshot(deck)).deck.slides,insert=await apply(deck,"dark",1,{mode:"insert-slide",slideId:"inserted"}),afterInsert=(await snapshot(deck)).deck.slides;assert.equal(afterInsert.length,before.length+1);assert.deepEqual(afterInsert.slice(0,before.length).map(({version,...slide})=>slide),before.map(({version,...slide})=>slide))
  await apply(deck);assert.equal((await snapshot(deck)).deck.slides.length,afterInsert.length)
  await call(`/api/assets/${asset.id}`,undefined,"DELETE");assert.equal((await request.get(`${stack.origin}/api/assets/${asset.id}/media`)).status(),200)
  await exportDeck(deck,"removed-library-still-used.pptx")
  await receipt({insert:insert.receipt,counts:[before.length,afterInsert.length],originalSlidesUnchangedOnInsert:true,listingRemoved:true,usedAssetStatus:200})

  lane=10
  const beforeUndo=await snapshot(deck),undoId=uid();await apply(deck,"light",1,{requestId:undoId});const latest=await snapshot(deck);await call(`/api/decks/${deck}/commands`,{id:uid(),kind:"patch",base:latest.seq,run:null,target:"s0",fields:{notes:"Later person notes"}});await call(`/api/decks/${deck}/commands`,{id:uid(),kind:"undo",target:undoId});const undone=await snapshot(deck);assert.deepEqual(undone.deck.template,beforeUndo.deck.template);assert.equal(undone.deck.slides[0].notes,"Later person notes")
  const capacity=await call("/api/assets");await stack.database(client=>client.query("UPDATE image_owner SET quota=$1 WHERE owner=$2",[capacity.used,account]));const fresh=await sharp({create:{width:10,height:10,channels:3,background:"red"}}).png().toBuffer(),fullJob=await call("/api/assets/ingest",{base64:fresh.toString("base64"),requestId:uid()},"POST",202);await worker();await call(`/api/assets/jobs/${fullJob.id}/adopt`,{},"POST",413);assert.equal((await request.get(`${stack.origin}/api/assets/${asset.id}/media`)).status(),200)
  await receipt({undoRestored:undone.deck.template,laterNotes:undone.deck.slides[0].notes,quota:capacity.used,uploadStatus:413,existingAssetStatus:200})

  await apply(deck,saved.id);await page.goto(stack.origin+`/deck/${deck}`);await page.locator('[data-sync-state="saved"]').waitFor();await page.getByRole("button",{name:"Design",exact:true}).click();await expect(page.getByLabel("Design panel")).toBeVisible();await shot("template-design-new-version");await page.getByRole("button",{name:"Choose template",exact:true}).click();await shot("template-picker");await page.getByRole("button",{name:"Close picker",exact:true}).click()
  await page.getByLabel("Use this look").selectOption("insert-slide");await shot("template-insert")
  await page.getByRole("button",{name:"Close design"}).click();await page.getByRole("button",{name:"Images",exact:true}).click();await shot("image-library-quota")
  await page.getByLabel("Adjust a placed image").selectOption("pictureA");await expect(page.getByText("Crop, focus and alt text",{exact:true})).toBeVisible();await shot("image-crop-focus-alt")
  await page.getByLabel("Crop zoom",{exact:true}).fill("5");await shot("image-low-resolution")
  await page.getByLabel("Image source").selectOption("local-stock");await page.getByRole("textbox",{name:"Search images"}).fill("no-result-01234");await page.getByRole("button",{name:"Search",exact:true}).click();await expect(page.getByText(/No images found for/)).toBeVisible();await shot("image-no-results")
  await page.getByLabel("Upload image",{exact:true}).setInputFiles({name:"unsafe.svg",mimeType:"image/svg+xml",buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')});await expect(page.getByText("Checking your image…",{exact:true})).toBeVisible();await worker();await expect(page.getByRole("alert")).toBeVisible();await shot("image-refusal")
  await page.getByLabel("Upload image",{exact:true}).setInputFiles({name:"quota.png",mimeType:"image/png",buffer:fresh});await expect(page.getByText("Checking your image…",{exact:true})).toBeVisible();await worker();await expect(page.getByRole("alert")).toContainText("storage is full");await shot("image-storage-full")
  await page.getByRole("button",{name:"Close images",exact:true}).click();await page.getByRole("button",{name:"Design",exact:true}).click();await page.getByRole("button",{name:"Choose template",exact:true}).click();await page.getByRole("button",{name:/Missing font example · v1/}).click();await shot("template-missing-font");await page.getByRole("button",{name:"Choose template",exact:true}).click();await page.getByRole("button",{name:/No embedding example · v1/}).click();await shot("template-no-embedding")
  await page.goto(stack.origin);await shot("home-spacing");await page.getByRole("button",{name:"+ New deck",exact:true}).click();await page.getByLabel("New deck",{exact:true}).getByRole("button",{name:"Import PowerPoint",exact:true}).click();await page.getByLabel("Import PowerPoint",{exact:true}).setInputFiles({name:"source.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",buffer:source});await expect(page.getByText("Import queued",{exact:false})).toBeVisible();await shot("import-progress")
  await stack.database(client=>client.query("UPDATE image_owner SET quota=$1 WHERE owner=$2",[512*1024*1024,account]))
  await writeFile(`${output}/live.json`,JSON.stringify({head,lanes:10,verdict:"pass",perf:"See perf/verdict.json; a failing perf gate fails this probe",database:"unique PostgreSQL, dropped in finally"},null,2))
  await writeFile(`${output}/review/browser.json`,JSON.stringify({head,browser:context.browser().version(),capture:"agent-browser CLI via Chrome DevTools Protocol",viewport:[1440,320]},null,2))
  await runPerformance({page,stack,call,worker,head,output,create,edit,apply,uid,shot,deck})
  await writeFile(`${output}/live.json`,JSON.stringify({head,lanes:10,verdict:"pass",database:"unique PostgreSQL, dropped in finally"},null,2))
}finally{await writeFile(`${output}/last-trace.json`,JSON.stringify(trace,null,2));await other.close();await context.close();await exec("agent-browser",["--session","p06","close"]).catch(()=>undefined);await stack.close();await rm(profile,{recursive:true,force:true})}
