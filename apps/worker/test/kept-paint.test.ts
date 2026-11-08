import { it, expect } from "vitest"
import { chromium } from "playwright"
import sharp from "sharp"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { captureDocument } from "../../../packages/render/src/capture-document.tsx"
import { renderDocument } from "../src/export/render.tsx"

it("paints preservation labels in shared and server captures and retains one PDF page per slide", async () => {
  const deck=fixtureDeck(1),slide=deck.slides[0]!,element=slide.elements[0]!
  slide.elements=[{...element,box:{x:-10,y:-10,width:0,height:0},source:{kind:"original",part:"ppt/slides/slide1.xml",sha256:"hash",objectId:"table:0",dependencies:[]},support:{kind:"kept",preview:"data:image/png;base64,broken"}}]
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
