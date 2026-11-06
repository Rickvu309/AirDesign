import assert from "node:assert/strict"
import os from "node:os"
import path from "node:path"
import {execFileSync} from "node:child_process"
import {readFile,mkdir,writeFile} from "node:fs/promises"
import {createHash} from "node:crypto"
import {importPptx,exportPptx,patchText} from "../../packages/pptx/src/index.ts"
const source="fixtures/pptx/preservation.pptx",before=await readFile(source),original=await importPptx(before)
const text="A clearer plan for the next quarter",edited=patchText(original,"ppt/slides/slide1.xml",0,text),after=await exportPptx(edited),reopened=await importPptx(after)
assert.ok(reopened.parts.get("ppt/slides/slide1.xml").toString().includes(text))
const retained=[]
for(const [name,bytes]of original.parts)if(name!=="ppt/slides/slide1.xml"){assert.deepEqual(reopened.parts.get(name),bytes,name);retained.push(name)}
const sha=bytes=>createHash("sha256").update(bytes).digest("hex")
const root="apps/site/public/examples";await mkdir(root,{recursive:true});await writeFile(`${root}/before.pptx`,before);await writeFile(`${root}/after.pptx`,after)
await writeFile(`${root}/provenance.json`,JSON.stringify({source,license:"Repository synthetic fixture; no third-party deck",beforeSha256:sha(before),afterSha256:sha(after),operation:{part:"ppt/slides/slide1.xml",textIndex:0,text},unchangedParts:retained,validation:"Local package import/export/reimport only. Windows/Mac PowerPoint validation blocked on X01. Safety removals follow the importer policy.",removed:original.report},null,2))
await mkdir("apps/site/examples",{recursive:true});await writeFile("apps/site/examples/index.html",`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AirDesign example provenance</title><link rel="stylesheet" href="/src/site.css"><body><main id="main"><section><a href="/">AirDesign</a><h1>One title, changed.</h1><p>This synthetic repository deck demonstrates a local text edit. It is not an evaluated deck design.</p><p><a href="/examples/before.pptx">Before PowerPoint</a> · <a href="/examples/after.pptx">After PowerPoint</a> · <a href="/examples/provenance.json">Hashes and provenance</a></p><p>The local engine reopens the output and checks unchanged package parts. Validation in Windows and Mac PowerPoint is pending. Review import warnings before editing.</p></section></main></body></html>`)
const evidence=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
await mkdir(path.join(evidence,"lane-9"),{recursive:true});await writeFile(path.join(evidence,"lane-9/examples.json"),JSON.stringify({head,status:"pass",beforeSha256:sha(before),afterSha256:sha(after),unchangedParts:retained,provenance:"apps/site/public/examples/provenance.json"},null,2))
console.log(JSON.stringify({head,example:"local text round trip",before:sha(before),after:sha(after),unchangedParts:retained.length}))
