import {layoutTextShadows} from "../../../../packages/render/src/text/shadow-layout.ts"
import type {Slide} from "../../../../packages/deck/src/model.ts"
import type {NativeSlide} from "../../../../packages/deck/src/text/native-v3.ts"
import {decodeExportSnapshot, selectExportSlides} from "../../../../packages/rpc/src/text/export-snapshot.ts"
import {flatten} from "../../../../packages/deck/src/elements.ts"
import {jobPath} from "../job-path.ts"
import { readFile,writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { chromium } from "playwright"
import { importPptx } from "../../../../packages/pptx/src/index.ts"
import { writeSavedPptx, writeNativeSavedPptx } from "../../../../packages/pptx/src/export-deck.ts"
import { fontManifest } from "../../../../packages/render/src/font-manifest.ts"
import { fontReport } from "../../../../packages/render/src/fonts.ts"

try {
  const input=JSON.parse(await readFile(jobPath("input.json"),"utf8"))
  const frozen = decodeExportSnapshot(input.snapshotVersion, input.snapshot)
  const deck=frozen.snapshot.deck,seq=frozen.snapshot.seq
  if(!Number.isSafeInteger(seq)||seq<0)throw new Error("invalid-saved-version")
  const selected:string[]=input.options.slides
  const slides=selectExportSlides<Slide | NativeSlide>(deck.slides, selected)
  const saved={...deck,slides}
  const fonts=await Promise.all(fontManifest.faces.map(async face=>{const bytes=await readFile(new URL(`../../../../packages/ui/fonts/${face.file}`,import.meta.url));if(createHash("sha256").update(bytes).digest("hex")!==face.sha256)throw new Error("font-hash-mismatch");return `@font-face{font-family:Geist;font-weight:${face.weight};src:url(data:font/woff2;base64,${bytes.toString("base64")}) format('woff2')}`}))
  const flags=slides.flatMap(slide=>flatten(slide.elements).filter(element=>element.support.kind!=="native").map(element=>({slide:slide.id,element:element.id,kind:element.support.kind})))
  const missingFonts=[...new Set(slides.flatMap(slide=>fontReport(slide,deck.themes).missing))]
  const removals=input.snapshot.source ? (await importPptx(Buffer.from(input.snapshot.source,"base64"))).report.removals : []
  if((flags.length||missingFonts.length||removals.length)&&!input.options.allowIssues)throw new Error("export-needs-review")
  const digest=createHash("sha256").update(JSON.stringify({deck:saved,seq})).digest("hex")
  const report={removals,provenance:input.snapshot.provenance ?? {},deck:deck.id,seq,slideIds:slides.map(slide=>slide.id),savedVersionSha256:digest,fontManifest,flags,acknowledged:input.options.allowIssues,missingFonts,referenceGate:"P09-X01-unproven"}
  let output:Buffer
  if(input.options.format==="pptx")output=frozen.snapshotVersion === 3 ? await writeNativeSavedPptx({...frozen.snapshot.deck, slides: selectExportSlides(frozen.snapshot.deck.slides, selected)}, seq, input.snapshot.source ? Buffer.from(input.snapshot.source,"base64") : null, report, input.snapshot.assets ?? {}, input.snapshot.templates ?? {}) : await writeSavedPptx({...frozen.snapshot.deck, slides: selectExportSlides(frozen.snapshot.deck.slides, selected)},seq,input.snapshot.source ? Buffer.from(input.snapshot.source,"base64") : null,report,input.snapshot.assets ?? {},input.snapshot.templates ?? {})
  else {
    const first=slides[0];if(!first)throw new Error("empty-export")
    if(slides.some(slide=>slide.size.width!==first.size.width||slide.size.height!==first.size.height))throw new Error("mixed-slide-sizes-require-fix")
    const {renderDocument}=await import(new URL("../../dist/render.js",import.meta.url).href)
    const browser=await chromium.launch({args:["--no-sandbox"]})
    try {
      const context=await browser.newContext({offline:true,viewport:{width:Math.ceil(first.size.width),height:Math.ceil(first.size.height)}})
      const page=await context.newPage()
      await page.route("**/*",route=>route.abort())
      await page.setContent(renderDocument(saved,seq,fonts.join(""),digest,input.snapshot.assets ?? {}),{waitUntil:"load"})
      await page.evaluate(async()=>{const fonts=await Promise.all([document.fonts.load("400 16px Geist"),document.fonts.load("600 16px Geist")]);await document.fonts.ready;if(fonts.some(faces=>!faces.length))throw new Error("pinned-fonts-unavailable")})
      await page.evaluate(layoutTextShadows)
      output=await page.pdf({width:`${first.size.width}px`,height:`${first.size.height}px`,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}})
      await page.locator(".export-slide").first().screenshot({path:jobPath("internal.png"),animations:"disabled"})
    }finally{await browser.close()}
  }
  await writeFile(jobPath("result.bin"),output)
  await writeFile(jobPath("report.json"),JSON.stringify(report))
}catch(error){await writeFile(jobPath("failure.json"),JSON.stringify({code:error instanceof Error ? error.message.slice(0,200) : "export-failed"}));process.exitCode=1}
