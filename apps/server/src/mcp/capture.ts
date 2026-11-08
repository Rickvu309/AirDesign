import type {NativeDeck, NativeElement} from "../../../../packages/deck/src/text/native-v3.ts"
import {chromium,type Browser} from "playwright"
import {readFile} from "node:fs/promises"
import {createHash} from "node:crypto"
import sharp from "sharp"
import {fontManifest} from "../../../../packages/render/src/font-manifest.ts"
import type {Deck,Element} from "../../../../packages/deck/src/index.ts"
import type {HistoryStore} from "../db/history-store.ts"
import type {Principal} from "../../../../packages/change-log/src/index.ts"
export function slideCaptures(history:HistoryStore){
  let browser:Promise<Browser>|null=null
  const fonts=Promise.all(fontManifest.faces.map(async face=>{const bytes=await readFile(new URL(`../../../../packages/ui/fonts/${face.file}`,import.meta.url));if(createHash("sha256").update(bytes).digest("hex")!==face.sha256)throw new Error("font-hash-mismatch");return `@font-face{font-family:Geist;font-weight:${face.weight};src:url(data:font/woff2;base64,${bytes.toString("base64")}) format('woff2')}`}))
  return {
    async capture(principal:Principal,deck:Deck|NativeDeck,slideId:string,width:number){
      const slide=deck.slides.find(item=>item.id===slideId);if(!slide)throw new Error("slide-not-found")
      const assets:Record<string,string>={}
      async function images(elements:readonly (Element|NativeElement)[]):Promise<void>{for(const element of elements){if(element.kind==="group")await images(element.children);else if(element.kind==="image"){const image=await history.images.media(principal,element.image.asset,"normalized");assets[element.image.asset]=`data:${image.mime};base64,${image.bytes.toString("base64")}`}}}
      await images(slide.elements)
      const modulePath=new URL("../../dist/capture-document.js",import.meta.url).href
      const renderer:{captureDocument:(deck:Deck|NativeDeck,slide:string,css:string,assets:Record<string,string>)=>string}=await import(modulePath)
      browser??=chromium.launch({headless:true})
      const page=await (await browser).newPage({viewport:{width:Math.ceil(slide.size.width),height:Math.ceil(slide.size.height)},deviceScaleFactor:1})
      try{await page.setContent(renderer.captureDocument(deck,slideId,(await fonts).join(""),assets));await page.evaluate(()=>document.fonts.ready.then(()=>undefined));const bytes=await page.locator("[data-slide]").screenshot({animations:"disabled"});let preview=await sharp(bytes).resize({width}).png().toBuffer()
        let previewWidth=width
        while(Buffer.byteLength(preview.toString("base64"))+2000>490000){previewWidth=Math.max(1,Math.floor(previewWidth*0.75));preview=await sharp(bytes).resize({width:previewWidth}).png().toBuffer()}
        return {full:bytes,preview}}finally{await page.close()}
    },
    async close(){if(browser)await (await browser).close()},
  }
}
