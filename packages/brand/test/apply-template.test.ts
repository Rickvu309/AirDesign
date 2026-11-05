import { describe, it, expect } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { applyTemplate, basics, newerVersion, parseTemplate } from "../src/index.ts"
import { TemplateStore } from "../src/template-store.ts"
import { fixtureDeck } from "../../deck/src/fixture.ts"
import { apply, parseDeck, themeId } from "../../deck/src/index.ts"
import { writeSavedPptx } from "../../pptx/src/export-deck.ts"
import { importPptx } from "../../pptx/src/index.ts"
import { layoutFamilies } from "../src/layout-families.ts"
import { commandId, execute, initialHistory } from "../../change-log/src/index.ts"

describe("versioned templates", () => {
  const dark = basics[1]!
  it("changes linked styles, lists local overrides and undoes in one step retaining later notes", () => {
    const deck = fixtureDeck(2)
    deck.slides[0]!.elements[0]!.theme = themeId("default")
    const plan = applyTemplate(deck,dark,{kind:"apply-deck"})
    expect(plan.retained).toEqual(["s0e1"])
    const result = execute(initialHistory(deck),{id:commandId("look"),kind:"edit",base:0,run:null,changes:plan.changes})
    expect(result.receipt.kind).toBe("applied")
    expect(result.history.deck.template).toEqual({id:"dark",version:1,family:"basic"})
    expect(result.history.deck.slides[0]!.elements[1]).toEqual(deck.slides[0]!.elements[1])
    const later = execute(result.history,{id:commandId("notes"),kind:"patch",base:1,run:null,target:deck.slides[0]!.id,fields:{notes:"Later person edit"}})
    const undone = execute(later.history,{id:commandId("undo"),kind:"undo",target:commandId("look")})
    expect(undone.history.deck.slides[0]!.notes).toBe("Later person edit")
    expect(undone.history.deck.themes).toEqual(deck.themes)
    expect(undone.history.deck.template).toBeUndefined()
  })
  it("preserves unlinked color within a linked text element", () => {
    const deck = fixtureDeck(1), text = deck.slides[0]!.elements[0]!
    if (text.kind !== "text") throw new Error("text-fixture")
    text.theme = themeId("default")
    Object.assign(text,{styleLinks:["font"]})
    const plan = applyTemplate(deck,dark,{kind:"apply-deck"})
    const result = apply(deck,plan.changes)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("apply-failed")
    const changed = result.deck.slides[0]!.elements[0]!
    expect(changed.kind === "text" && changed.runs[0].color).toBe(text.runs[0].color)
    expect(plan.retained).toContain("s0e0.color")
  })
  it("inserts without altering existing slides or pinned deck template", () => {
    const deck=fixtureDeck(1), result=apply(deck,applyTemplate(deck,dark,{kind:"insert-slide",slideId:"inserted",family:"basic"}).changes)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("apply-failed")
    expect(result.deck.slides.slice(0,1)).toEqual(deck.slides)
    expect(result.deck.slides).toHaveLength(2)
    expect(result.deck.template).toBeUndefined()
  })
  it("offers a newer version without mutating the pinned deck", () => {
    const deck=fixtureDeck(1)
    deck.template={id:"dark",version:1,family:"basic"}
    expect(newerVersion(deck,[{...dark,version:2}])?.version).toBe(2)
    expect(deck.template.version).toBe(1)
  })
  it("requires deliberate substitution and reports no embedding rights", () => {
    expect(()=>applyTemplate(fixtureDeck(1),{...dark,fontRight:"missing"},{kind:"apply-deck"})).toThrow("choose-font-substitution")
    expect(applyTemplate(fixtureDeck(1),{...dark,fontRight:"missing"},{kind:"apply-deck"},"basic","Geist").changes.changes).toHaveLength(1)
    expect(applyTemplate(fixtureDeck(1),{...dark,fontRight:"no-embedding"},{kind:"apply-deck"}).warnings[0]).toContain("cannot be embedded")
  })
  it("rejects malformed template and pinned version data at the boundary", () => {
    expect(()=>parseTemplate({...dark,version:0})).toThrow()
    expect(()=>parseTemplate({...dark,families:[...dark.families,...dark.families]})).toThrow()
    expect(()=>parseDeck({...fixtureDeck(1),template:{id:"dark",version:0,family:"basic"}})).toThrow()
  })
  it("keeps saved versions immutable and defaults owner scoped across restarts", () => {
    const dir=mkdtempSync(path.join(os.homedir(),"tmp/p06-template-")), filename=path.join(dir,"templates.sqlite")
    let store=new TemplateStore(filename)
    try {
      const a={personId:"alice"}, b={personId:"bob"}, own={...dark,id:"own",version:1}
      store.save(a,own)
      expect(()=>store.get(b,"own",1)).toThrow("not-found")
      expect(()=>store.save(a,{...own,name:"Mutated"})).toThrow("immutable-template-version")
      store.setDefault(a,"own",1)
      store.save(a,{...own,version:2,name:"New version"})
      expect(store.default(a).version).toBe(1)
      expect(store.default(b).id).toBe("light")
      store.close();store=new TemplateStore(filename)
      expect(store.default(a)).toEqual(own)
    } finally {store.close();rmSync(dir,{recursive:true,force:true})}
  })
})

it("exports linked template masters with closed layout relationships",async()=>{
  const deck=fixtureDeck(2,2),dark=basics[1]!
  const result=apply(deck,applyTemplate(deck,dark,{kind:"apply-deck"}).changes)
  if(!result.ok)throw new Error(result.error.message)
  const bytes=await writeSavedPptx(result.deck,1,null,{referenceGate:"P09-X01-unproven"})
  const imported=await importPptx(bytes)
  expect(imported.report.relationships.filter(rel=>rel.type.endsWith("/slideLayout") && rel.part.startsWith("ppt/slides/"))).toHaveLength(2)
  const families=layoutFamilies(imported.report.relationships)
  expect(families.length).toBeGreaterThan(0)
  expect(new Set(families.map(family=>family.master)).size).toBe(families.length)
  expect([...imported.parts].some(([name,bytes])=>name.startsWith("ppt/slideLayouts/")&&name.endsWith(".xml")&&bytes.toString().includes("172333"))).toBe(true)
})

it("groups imported layout families by distinct master without merging them",()=>{
  const relation=(part:string,target:string)=>({part,target,type:"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"})
  const families=layoutFamilies([relation("ppt/presentation.xml","ppt/slideMasters/slideMaster1.xml"),relation("ppt/slideLayouts/slideLayout1.xml","ppt/slideMasters/slideMaster1.xml"),relation("ppt/slideLayouts/slideLayout2.xml","ppt/slideMasters/slideMaster2.xml")])
  expect(families.map(family=>family.layouts)).toEqual([["ppt/slideLayouts/slideLayout1.xml"],["ppt/slideLayouts/slideLayout2.xml"]])
})
