import { mkdir,writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { fixtureDeck } from "../packages/deck/src/fixture.ts"
import { apply,themeId } from "../packages/deck/src/index.ts"
import { basics,applyTemplate } from "../packages/brand/src/index.ts"
import { writeSavedPptx } from "../packages/pptx/src/export-deck.ts"
import { importPptx } from "../packages/pptx/src/index.ts"
const deck=fixtureDeck(2,2),template=basics[1]
if(!template)throw new Error("dark-template-required")
for(const slide of deck.slides)for(const element of slide.elements)element.theme=themeId("default")
const result=apply(deck,applyTemplate(deck,template,{kind:"apply-deck"}).changes)
if(!result.ok)throw new Error(result.error.message)
const output=path.join(os.homedir(),"tmp/airdesign-autopilot/P03/P03R/p06-template.pptx")
await mkdir(path.dirname(output),{recursive:true})
const bytes=await writeSavedPptx(result.deck,1,null,{referenceGate:"P09-X01-unproven"})
const imported=await importPptx(bytes)
await writeFile(output,bytes)
await writeFile(output+".relationships.json",JSON.stringify({referenceGate:"P09-X01-unproven",relationships:imported.report.relationships.filter(rel=>/\/(slideMaster|slideLayout)$/.test(rel.type))},null,2))
process.stdout.write(JSON.stringify({output,bytes:bytes.length,relationships:imported.report.relationships.length})+"\n")
