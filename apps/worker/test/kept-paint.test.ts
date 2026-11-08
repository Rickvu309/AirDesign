import { it, expect } from "vitest"
import { chromium } from "playwright"
import sharp from "sharp"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { captureDocument } from "../../../packages/render/src/capture-document.tsx"
import { renderDocument } from "../src/export/render.tsx"

it("paints preservation labels in shared and server captures and retains one PDF page per slide", async () => {
  const deck=fixtureDeck(1),slide=deck.slides[0]!,element=slide.elements[0]!
  slide.elements=[{...element,box:{x:-10,y:-10,width:0,height:0},source:{kind:"original",part:"ppt/slides/slide1.xml",sha256:"hash",objectId:"table:0",dependencies:[]},support:{kind:"kept",preview:"data:image/png;base64,broken"}},{...element,id:"background" as typeof element.id,kind:"shape",geometry:"rectangle",fill:"white",box:{x:0,y:0,width:slide.size.width,height:slide.size.height},support:{kind:"native"}}]
  const browser=await chromium.launch({args:["--no-sandbox"]})
  try {
    const page=await browser.newPage({viewport:{width:1500,height:1100}})
    for(const html of [captureDocument(deck,slide.id,"",{}),renderDocument(deck,0,"","paint",{})]){
      await page.setContent(html)
      const label=page.locator("[data-preservation]")
      expect(await label.innerText()).toContain("Table · Preserved on export")
      const before=await label.screenshot()
      await label.evaluate(node=>{node.style.visibility="hidden"})
      const box=await label.boundingBox();if(!box)throw new Error("paint-box-required")
      const after=await page.screenshot({clip:box})
      await label.evaluate(node=>{node.style.removeProperty("visibility")})
      const a=await sharp(before).removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(after).resize(a.info.width,a.info.height).removeAlpha().raw().toBuffer()
      expect(a.data.filter((value,index)=>Math.abs(value-b[index]!)>32).length).toBeGreaterThan(100)
    }
    const pdf=await getDocument({data:new Uint8Array(await page.pdf({width:`${slide.size.width}px`,height:`${slide.size.height}px`,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}})),useSystemFonts:false}).promise
    try {
      expect(pdf.numPages).toBe(1)
      const text=(await (await pdf.getPage(1)).getTextContent()).items.map(item=>"str" in item ? item.str : "").join(" ")
      expect(text).toContain("Preserved on export")
      expect(text).toContain("Table")
    }finally{await pdf.cleanup()}
  }finally{await browser.close()}
})
it("keeps zero, tiny, negative and overflowing fallback ink inside source-sized canvases", async()=>{
  const deck=fixtureDeck(1),slide=deck.slides[0]!,element=slide.elements[0]!
  const browser=await chromium.launch({args:["--no-sandbox"]})
  try{
    const page=await browser.newPage()
    for(const box of [{x:0,y:0,width:0,height:0},{x:50,y:50,width:1,height:1},{x:-400,y:-400,width:20,height:20},{x:959,y:539,width:50,height:60}])for(const preview of [null,"","data:image/png;base64,broken"]){
      slide.elements=[{...element,box,support:{kind:"kept",preview}}]
      const original=JSON.stringify(slide)
      for(const html of [captureDocument(deck,slide.id,"",{}),renderDocument(deck,0,"","bounds",{})]){
        await page.setContent(html)
        expect(await page.locator("[data-import-content-report]").count()).toBe(0)
        const canvas=page.locator("[data-slide]"),label=page.locator("[data-preservation]")
        const bounds=await label.boundingBox(),frame=await canvas.boundingBox()
        expect(bounds!.x).toBeGreaterThanOrEqual(frame!.x);expect(bounds!.y).toBeGreaterThanOrEqual(frame!.y)
        expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(frame!.x+frame!.width)
        expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(frame!.y+frame!.height)
        const before=await canvas.screenshot()
        expect(await sharp(before).metadata()).toMatchObject({width:slide.size.width,height:slide.size.height})
        await label.evaluate(node=>{node.style.visibility="hidden"})
        const after=await canvas.screenshot()
        const a=await sharp(before).removeAlpha().raw().toBuffer(),b=await sharp(after).removeAlpha().raw().toBuffer()
        expect(a.filter((v,i)=>Math.abs(v-b[i]!)>32).length).toBeGreaterThan(100)
      }
      expect(JSON.stringify(slide)).toBe(original)
    }
  }finally{await browser.close()}
},30000)
it("renders useful previews at full height and leaves bottom native content uncovered in print",async()=>{
  const deck=fixtureDeck(1),slide=deck.slides[0]!,element=slide.elements[0]!
  if(element.kind!=="text")throw new Error("text-required")
  const preview="data:image/png;base64,"+(await sharp({create:{width:400,height:300,channels:3,background:"red"}}).png().toBuffer()).toString("base64")
  slide.elements=[{...element,id:"preview" as typeof element.id,box:{x:0,y:0,width:400,height:300},support:{kind:"kept",preview}},{...element,box:{x:0,y:470,width:900,height:60},runs:[{...element.runs[0]!,text:"BOTTOM NATIVE MARKER",size:24}]}]
  const browser=await chromium.launch({args:["--no-sandbox"]})
  try{
    const page=await browser.newPage()
    await page.setContent(renderDocument(deck,0,"","preview",{}));await page.emulateMedia({media:"print"})
    expect(await page.locator("[data-import-content-report]").count()).toBe(0)
    const image=await page.locator("image").boundingBox()
    expect(image!.height).toBe(300)
    const raw=await sharp(await page.screenshot({clip:{x:0,y:0,width:400,height:300}})).removeAlpha().raw().toBuffer()
    expect(raw.filter((v,i)=>i%3===0&&v>240).length).toBeGreaterThan(400*300*0.98)
    slide.elements[0]!.box={x:400,y:350,width:1,height:1}
    await page.setContent(renderDocument(deck,0,"","tiny-preview",{}))
    expect(await page.locator("image").boundingBox()).toMatchObject({x:400,y:350,width:1,height:1})
    slide.elements[0]!.box={x:0,y:0,width:400,height:300}
    await page.setContent(renderDocument(deck,0,"","preview",{}))
    const marker=page.locator(`[data-element="${element.id}"]`)
    expect(await marker.innerText()).toContain("BOTTOM NATIVE MARKER")
    const before=await page.locator("[data-slide]").screenshot()
    await marker.evaluate(node=>{node.style.visibility="hidden"})
    const after=await page.locator("[data-slide]").screenshot()
    const a=await sharp(before).removeAlpha().raw().toBuffer(),b=await sharp(after).removeAlpha().raw().toBuffer()
    expect(a.filter((v,i)=>Math.abs(v-b[i]!)>32).length).toBeGreaterThan(100)
  }finally{await browser.close()}
})
it("public snapshot captures the source canvas rather than its surrounding section",async()=>{
  const {createServer}=await import("node:http"),{snapshot}=await import("../../../packages/render/src/server.ts")
  const deck=fixtureDeck(1),slide=deck.slides[0]!
  slide.elements[0]!.support={kind:"kept",preview:null}
  const html=captureDocument(deck,slide.id,"",{}).replace('<body>','<body><div data-ready="true"><label>Deck JSON<textarea></textarea></label><button>Load saved deck</button></div>').replace('</section>','<div style="height:200px">Outside the slide</div></section>')
  const server=createServer((_req,res)=>{res.end(html)})
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve))
  try{
    const address=server.address();if(!address||typeof address==="string")throw new Error("address-required")
    const png=await snapshot({deck,slideId:slide.id,origin:`http://127.0.0.1:${address.port}`})
    expect(await sharp(png).metadata()).toMatchObject({width:slide.size.width,height:slide.size.height})
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
})

it("keeps each crowded marker visible when native bounds favor the same empty corner",async()=>{
  const deck=fixtureDeck(1),slide=deck.slides[0]!,element=slide.elements[0]!
  const kept={...element,box:{x:0,y:0,width:0,height:0},support:{kind:"kept" as const,preview:null}}
  slide.elements=[{...kept,id:"first" as typeof element.id},{...kept,id:"second" as typeof element.id},...([{x:204,y:0,width:756,height:540},{x:0,y:40,width:204,height:500}].map((box,index)=>({...element,id:`background${index}` as typeof element.id,kind:"shape" as const,geometry:"rectangle" as const,fill:"white",box,support:{kind:"native" as const}})))]
  const browser=await chromium.launch({args:["--no-sandbox"]})
  try{
    const page=await browser.newPage()
    for(const html of [captureDocument(deck,slide.id,"",{}),renderDocument(deck,0,"","crowded",{})]){
      await page.setContent(html)
      const first=await page.locator('[data-preservation="first"]').boundingBox(),second=await page.locator('[data-preservation="second"]').boundingBox()
      expect(first!.x!==second!.x||first!.y!==second!.y).toBe(true)
      for(const id of ["first","second"]){
        const label=page.locator(`[data-preservation="${id}"]`),canvas=page.locator("[data-slide]"),before=await canvas.screenshot()
        await label.evaluate(node=>{node.style.visibility="hidden"})
        const after=await canvas.screenshot(),a=await sharp(before).removeAlpha().raw().toBuffer(),b=await sharp(after).removeAlpha().raw().toBuffer()
        expect(a.filter((v,i)=>Math.abs(v-b[i]!)>32).length).toBeGreaterThan(100)
        await label.evaluate(node=>{node.style.removeProperty("visibility")})
      }
    }
  }finally{await browser.close()}
})

it("keeps partial and unverified history labels readable within their compact marker",async()=>{
  const deck=fixtureDeck(1),slide=deck.slides[0]!,element=slide.elements[0]!,browser=await chromium.launch({args:["--no-sandbox"]})
  try{
    const page=await browser.newPage()
    for(const preservation of ["partial","reported"] as const){
      slide.elements=[{...element,support:{kind:"flagged",preservation,preview:null,reason:"safety"}}]
      await page.setContent(renderDocument(deck,0,"","labels",{}))
      const label=page.locator("[data-preservation]")
      expect(await label.innerText()).toContain(preservation==="partial" ? "Some removed for safety" : "(unverified)")
      expect((await label.innerText()).toLowerCase()).toContain("preserved on export")
      expect(await label.evaluate(node=>node.scrollHeight<=node.clientHeight)).toBe(true)
    }
  }finally{await browser.close()}
})
