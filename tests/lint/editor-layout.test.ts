import {readFileSync} from "node:fs"
import {expect,it} from "vitest"
import {editorLayoutHits} from "../../scripts/lint/editor-layout.ts"

it("rejects offline banners that reveal the hidden font-ready status",()=>{
  const file="apps/studio/src/editor/editor.css",source=readFileSync(file,"utf8")
  expect(editorLayoutHits(file,source.replaceAll("[data-sync-state=offline]>.editor-status:not([data-font-state])", "[data-sync-state=offline]>.editor-status"))).toMatchObject([{reason:"offline-banner-must-not-reveal-hidden-font-status"}])
  expect(editorLayoutHits(file,source)).toEqual([])
})

it("rejects desktop panel widths leaking into the phone offline banner",()=>{
  const file="apps/studio/src/editor/editor.css",source=readFileSync(file,"utf8")
  expect(editorLayoutHits(file,source.replace(",.studio-editor[data-chat=true],.studio-editor[data-design=true] { --editor-left:0px", " { --editor-left:0px"))).toMatchObject([{reason:"phone-editor-must-reset-desktop-panel-widths"}])
  expect(editorLayoutHits(file,source)).toEqual([])
})

it("rejects a scaled canvas that still takes up its unscaled layout height",()=>{
  const file="apps/studio/src/editor/editor.css",source=readFileSync(file,"utf8")
  expect(editorLayoutHits(file,source.replace(".slide-canvas { position:absolute;",".slide-canvas { "))).toMatchObject([{reason:"scaled-slide-canvas-must-not-affect-thumbnail-layout"}])
  expect(editorLayoutHits(file,source)).toEqual([])
})
it("rejects the original settings override of editor layout",()=>{
  const file="apps/studio/src/settings/settings.css",source=readFileSync(file,"utf8")
  expect(editorLayoutHits(file,source+".studio-editor[data-chat=true]{padding-inline-end:384px}")).toMatchObject([{reason:"editor-layout-belongs-in-editor-css"}])
  expect(editorLayoutHits(file,source)).toEqual([])
})
it("rejects duplicate editor and shell toast renderers",()=>{
  const file="apps/studio/src/editor/manual-editor.tsx",source=readFileSync(file,"utf8")
  expect(editorLayoutHits(file,source+"<Toaster/> ")).toMatchObject([{reason:"editor-must-use-the-shell-toaster"}])
  expect(editorLayoutHits(file,source)).toEqual([])
})
it("rejects the original Aira panel covering Export and zoom",()=>{
  const file="apps/studio/src/chat/chat.css",source=readFileSync(file,"utf8")
  expect(editorLayoutHits(file,source.replace("inset-block:56px 0","inset-block:0").replace("z-index:25","z-index:30"))).toMatchObject([{reason:"aira-must-leave-export-and-zoom-above-the-panel"}])
  expect(editorLayoutHits(file,source)).toEqual([])
})
it("rejects an icon submit button without a stable accessible name",()=>{
  const file="apps/studio/src/chat/chat-panel.tsx",source=readFileSync(file,"utf8")
  expect(editorLayoutHits(file,source.replace(' aria-label={working ? "Steer" : "Send"}',""))).toMatchObject([{reason:"aira-icon-submit-needs-an-explicit-accessible-name"}])
  expect(editorLayoutHits(file,source)).toEqual([])
})

it.each([
 ["apps/studio/src/editor/manual-editor.tsx","event.patches.map(patch=>patch.id)"],
 ["apps/studio/src/editor/manual-editor.tsx","JSON.stringify(item.command,null,2)"],
 ["packages/render/src/slide.tsx",'aria-label={`Text ${element.id}`}'],
 ["apps/studio/src/images/image-panel.tsx",'aria-label={`Place ${image.provenance.kind} image ${image.id.slice(0,8)}`}']
])("rejects the original internal identifier or payload display in %s",(file,source)=>{
 expect(editorLayoutHits(file,source)).toMatchObject([{reason:"editor-content-labels-must-not-expose-internal-identifiers-or-command-payloads"}])
 expect(editorLayoutHits(file,readFileSync(file,"utf8"))).toEqual([])
})
