import assert from "node:assert/strict"
import {mkdir,writeFile,readFile} from "node:fs/promises"
import path from "node:path"
import {pathToFileURL} from "node:url"
import {chromium} from "playwright"
import {scenario,execute} from "../agent-account/fixture.mjs"
import {fontDeck,assertFontChange,assertStylePaint,content} from "../agent-account/font-contract.mjs"
import {writeSavedPptx} from "../../packages/pptx/src/export-deck.ts"
import {importPptx} from "../../packages/pptx/src/index.ts"
import {importedDeck} from "../../packages/pptx/src/import-deck.ts"
import {parseXml} from "../../packages/pptx/src/xml.ts"
import {fontManifest} from "../../packages/render/src/font-manifest.ts"

const out=path.resolve(process.env.FONT_EVIDENCE),renderer=await import(pathToFileURL(path.resolve(process.env.FONT_RENDERER)))
await mkdir(out,{recursive:true})
const save=async(name,value)=>writeFile(path.join(out,name+".json"),JSON.stringify(value,null,2)+"\n")
const revision={head:(await execute("git",["rev-parse","HEAD"])).stdout.trim(),dirty:(await execute("git",["status","--porcelain"])).stdout}
const fontCss=(await Promise.all(fontManifest.faces.map(async face=>`@font-face{font-family:Geist;font-weight:${face.weight};src:url(data:font/woff2;base64,${(await readFile(path.join("packages/ui/fonts",face.file))).toString("base64")})}`))).join("")
const families=["Liberation Sans","Liberation Serif"]
const s=await scenario({browserEnabled:true}),browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),readonly=await context.newPage(),events=[]
page.on("pageerror",error=>events.push({pageerror:error.message}));page.on("console",message=>{if(message.type()==="error")events.push({console:message.text()})})
const observe=async(target,selector)=>{
  const value=await target.locator(selector).evaluate(node=>({seq:Number(document.querySelector(".studio-editor")?.dataset.seq??0),fonts:[...node.querySelectorAll("span")].map(span=>getComputedStyle(span).fontFamily.replaceAll('"',"")),weights:[...node.querySelectorAll("span")].map(span=>getComputedStyle(span).fontWeight),texts:[...node.querySelectorAll("span")].map(span=>span.textContent)}))
  const session=await context.newCDPSession(target)
  try{
    await session.send("DOM.enable");await session.send("CSS.enable")
    const {root}=await session.send("DOM.getDocument"),{nodeIds}=await session.send("DOM.querySelectorAll",{nodeId:root.nodeId,selector:selector+" span"})
    value.platformFonts=await Promise.all(nodeIds.map(async nodeId=>(await session.send("CSS.getPlatformFontsForNode",{nodeId})).fonts))
    return value
  }finally{await session.detach()}
}
const assertPaint=(value,fonts)=>{assert.deepEqual(value.fonts.map(font=>font.split(",")[0].trim()),fonts);assert.deepEqual(value.platformFonts.map(runs=>[...new Set(runs.filter(font=>font.glyphCount>0).map(font=>font.familyName))]),fonts.map((font,index)=>[font==="Geist"&&value.weights[index]==="600" ? "Geist SemiBold" : font]));for(const [index,runs] of value.platformFonts.entries())if(fonts[index]==="Geist")assert.ok(runs.every(font=>font.isCustomFont))}
const target='[data-text="s0e0"][contenteditable="true"]'
const read=async(owner,id)=>s.request(owner,"/api/decks/"+id)
async function readonlyProof(deck,name){
  const html=renderer.captureDocument(deck,deck.slides[0].id,fontCss,{})
  await writeFile(path.join(out,name+"-readonly.html"),html);await readonly.setContent(html)
  await readonly.evaluate(()=>document.fonts.ready)
  const result=await observe(readonly,'[data-text="'+deck.slides[0].elements[0].id+'"]')
  await save(name+"-readonly",result);await readonly.screenshot({path:path.join(out,name+"-readonly.png")})
  assertPaint(result,deck.slides[0].elements[0].runs.map(run=>run.font))
  return result
}
async function exportProof(snapshot,name){
  const bytes=await writeSavedPptx(snapshot.deck,snapshot.seq,null,{});await writeFile(path.join(out,name+".pptx"),bytes)
  const presentation=await importPptx(bytes),xml=presentation.parts.get("ppt/slides/slide1.xml").toString(),notes=presentation.parts.get("ppt/notesSlides/notesSlide1.xml").toString()
  await writeFile(path.join(out,name+"-slide.xml"),xml);await writeFile(path.join(out,name+"-notes.xml"),notes)
  for(const run of snapshot.deck.slides[0].elements[0].runs){assert.ok(xml.includes(`typeface="${run.font}"`));assert.ok(xml.includes(run.text));assert.ok(xml.includes(`sz="${run.size*75}"`));assert.ok(xml.includes(run.color.slice(1)))}
  const parsed=parseXml(Buffer.from(notes)),within=(parent,child)=>child.start>parent.start&&child.end<parent.end
  const noteShape=kind=>parsed.nodes.find(node=>node.local==="sp"&&parsed.nodes.some(child=>within(node,child)&&child.local==="ph"&&child.attributes.type===kind))
  const noteText=shape=>parsed.nodes.filter(node=>shape&&within(shape,node)&&node.local==="t").map(node=>parsed.xml.slice(node.openEnd,node.closeStart)).join("\n")
  const nativeNotes=noteText(noteShape("body")),slideNumber=noteText(noteShape("sldNum"))
  assert.equal(nativeNotes,snapshot.deck.slides[0].notes);assert.equal(slideNumber,"1")
  const reopened=importedDeck(presentation),text=reopened.slides[0].elements.find(element=>element.kind==="text")
  assert.ok(text);assert.deepEqual(text.runs.map(run=>({...run,italic:!!run.italic,underline:!!run.underline})),snapshot.deck.slides[0].elements[0].runs.map(run=>({...run,italic:!!run.italic,underline:!!run.underline})))
  const notesExact=reopened.slides[0].notes===nativeNotes
  if(!notesExact)assert.equal(reopened.slides[0].notes,nativeNotes+"\n"+slideNumber)
  const notesReceipt={nativeBody:nativeNotes,expected:snapshot.deck.slides[0].notes,reimported:reopened.slides[0].notes,exact:notesExact,limit:notesExact ? null : "Existing importedDeck includes the sldNum footer in speaker notes"}
  await save(name+"-notes-receipt",notesReceipt)
  await save(name+"-reopened",reopened);await readonlyProof(reopened,name+"-reopened")
  return {bytes:bytes.length,fonts:text.runs.map(run=>run.font),native:true,notes:notesReceipt,microsoftPowerPoint:"unverified"}
}
async function editAndReload(owner,id,label){
  const before=await read(owner,id)
  for(let index=0;index<2;index++){
    const previous=await read(owner,id)
    await page.locator(target+" span").nth(index).evaluate(span=>{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(span);range.collapse(false);span.parentElement.focus();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event("selectionchange"))})
    await page.keyboard.insertText(" edited")
    await page.waitForFunction(seq=>{const node=document.querySelector(".studio-editor");return Number(node.dataset.seq)>seq&&node.dataset.syncState==="saved"},previous.seq)
  }
  const after=await read(owner,id),expected=structuredClone(before.deck)
  expected.slides[0].elements[0].runs=expected.slides[0].elements[0].runs.map(run=>({...run,text:run.text+" edited"}))
  await save(label+"-edit",{before,after});assert.deepEqual(content(after.deck),content(expected))
  await page.reload();await page.getByRole("button",{name:"Single slide view",exact:true}).click();await page.locator(target).waitFor();await page.waitForFunction(()=>document.querySelector(".studio-editor").dataset.syncState==="saved")
  const observed=await observe(page,target);await save(label+"-reload",{saved:after,observed});await page.screenshot({path:path.join(out,label+"-reload.png")})
  assertPaint(observed,after.deck.slides[0].elements[0].runs.map(run=>run.font));assert.deepEqual(observed.texts,after.deck.slides[0].elements[0].runs.map(run=>run.text))
  return after
}
try{
  const owner=await s.fixture.signIn("font-fidelity@example.com"),id="font-fidelity",deck=fontDeck(id)
  for(const slide of deck.slides)slide.elements[0].runs.forEach((run,index)=>{run.font=families[index];run.italic=index===1;run.underline=index===1})
  await s.request(owner,"/api/decks",deck,201)
  await context.addCookies(owner.cookie.split("; ").map(pair=>{const at=pair.indexOf("=");return {name:pair.slice(0,at),value:pair.slice(at+1),url:s.origin}}))
  await page.goto(s.origin+"/deck/"+id);await page.getByRole("button",{name:"Single slide view",exact:true}).click();await page.locator(target).waitFor();await page.evaluate(()=>document.fonts.ready)
  const initial=await observe(page,target),available=await page.evaluate(families=>families.map(font=>({font,available:document.fonts.check(`16px "${font}"`)})),families)
  await save("initial",{revision,deck,initial,available,systemFonts:(await execute("fc-list",[":","family"])).stdout})
  await page.screenshot({path:path.join(out,"initial-editable.png")});assertPaint(initial,families)
  assert.ok(available.every(font=>font.available));await readonlyProof(deck,"initial")
  const supplied=await editAndReload(owner,id,"supplied"),beforePaint=await observe(page,target),beforeExport=await exportProof(supplied,"before-aira")
  const run=await s.run(owner,id,"Apply brand font to this target",["s0e0"]);assert.equal(run.kind,"complete")
  const after=await read(owner,id)
  await page.waitForFunction(seq=>Number(document.querySelector(".studio-editor").dataset.seq)===seq,after.seq)
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const paint=await observe(page,target);await save("aira-paint",{revision,before:supplied,after,beforePaint,paint,run})
  assertPaint(paint,["Geist","Geist"]);assertFontChange(supplied.deck,after.deck,["s0e0"]);assertStylePaint(beforePaint,paint,paint,after.seq,families)
  assert.throws(()=>assertFontChange(supplied.deck,supplied.deck,["s0e0"]),/observable style mutation/)
  assert.throws(()=>assertFontChange(supplied.deck,after.deck,["s1e0"]),/preserve text/)
  assert.throws(()=>assertStylePaint(beforePaint,paint,{...beforePaint,seq:after.seq},after.seq,families),/changed rendered style/)
  await page.screenshot({path:path.join(out,"after-aira-editable.png")});await readonlyProof(after.deck,"after-aira")
  const branded=await editAndReload(owner,id,"branded"),afterExport=await exportProof(branded,"after-aira")
  assert.equal((await s.request(owner,"/api/usage")).used,3)
  await save("result",{revision,status:beforeExport.notes.exact&&afterExport.notes.exact ? "pass" : "font-pass-notes-fail",beforeExport,afterExport,checks:["initial readonly/editable supplied fonts","real selected Aira style paint","preserved content/notes/styles/sibling","no-op/sequence-only/wrong-target reject","supplied and branded edit/persist/reload","native PPTX fonts/styles/note body and imported font render"],events,limits:[...((beforeExport.notes.exact&&afterExport.notes.exact) ? [] : ["Existing reimport note-body contamination by slide-number footer; exact imported-note fidelity not accepted"]),"No Microsoft PowerPoint validation","Core worker writeSavedPptx/import path, not HTTP export job acceptance","No full benchmark or paid provider"]})
  assert.equal(beforeExport.notes.reimported,beforeExport.notes.expected,"before-Aira reimported notes must preserve body exactly")
  assert.equal(afterExport.notes.reimported,afterExport.notes.expected,"after-Aira reimported notes must preserve body exactly")
}catch(error){await save("failure",{revision,error:{name:error.name,message:error.message,stack:error.stack},page:{url:page.url(),text:await page.locator("body").innerText(),targets:await page.locator("[data-text]").evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.text,editable:node.contentEditable})))},events,trace:s.trace});throw error}finally{await context.close();await browser.close();await s.close()}
