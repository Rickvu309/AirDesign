import {afterEach,expect,it,vi} from "vitest"
import {DatabaseSync} from "node:sqlite"
import {mkdtemp,readFile,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {once} from "node:events"
import {Writable} from "node:stream"
import {spawn} from "node:child_process"
import {OperationStore,type OperationId} from "../../../packages/operations/src/index.ts"
import {importSlideProgressSchema,importProgressPrefix,type ImportSlideProgress} from "../../../packages/operations/src/import-progress.ts"
import {ImportProgressDecoder,ImportProgressWriter,ImportProgressForwarder,acceptImportProgress} from "../src/import-progress.ts"
import {importPptx,exportPptx} from "../../../packages/pptx/src/index.ts"
import {importedDeck,importedNativeDeck} from "../../../packages/pptx/src/import-deck.ts"
import * as deck from "../../../packages/deck/src/index.ts"
import {deliver} from "../src/isolation.ts"

const owner={personId:"progress-owner"},other={personId:"other"}
const progress=(completed:number,total=2):ImportSlideProgress=>({kind:"import-slides",completed,total})
const cleanups:(()=>Promise<void>)[]=[]
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllEnvs();for(const cleanup of cleanups.splice(0))await cleanup()})
async function storage(){
  const root=await mkdtemp(path.join(os.homedir(),"tmp/import-progress-")),filename=path.join(root,"operations.sqlite")
  let now=0
  const store=new OperationStore(filename,()=>now)
  cleanups.push(async()=>{store.close();await rm(root,{recursive:true,force:true})})
  return {root,filename,store,advance:(milliseconds=35001)=>{now+=milliseconds}}
}
function claim(store:OperationStore,id:OperationId){const value=store.claim(id);if(!value)throw new Error("claim-required");return value}

it("preflights every reference and counts validated real slides while preserving deck and part bytes",async()=>{
  const bytes=await readFile("fixtures/pptx/native.pptx"),source=await importPptx(bytes),events:unknown[]=[]
  const actual=importedDeck(source,value=>events.push(value))
  expect(events).toEqual([{completed:0,total:2},{completed:1,total:2},{completed:2,total:2}])
  expect(actual).toEqual(importedDeck(source))
  const output=await importPptx(await exportPptx(source))
  for(const [name,part] of source.parts)expect(output.parts.get(name),name).toEqual(part)
  const missing={...source,report:{...source.report,relationships:source.report.relationships.filter(rel=>rel.target!=="ppt/slides/slide2.xml")}}
  const preflight:unknown[]=[]
  expect(()=>importedDeck(missing,value=>preflight.push(value))).toThrow("slide-relationship-required")
  expect(preflight).toEqual([])
  const parts=new Map(source.parts),second=parts.get("ppt/slides/slide2.xml")
  if(!second)throw new Error("fixture-slide-required")
  parts.set("ppt/slides/slide2.xml",Buffer.from(second.toString().replaceAll(/cx="[0-9]+"/g, 'cx="NaN"')))
  const invalid:unknown[]=[]
  expect(()=>importedDeck({...source,parts},value=>invalid.push(value))).toThrow("invalid-import-slide")
  expect(invalid).toEqual([{completed:0,total:2},{completed:1,total:2}])
  const nativeInvalid:unknown[]=[]
  expect(()=>importedNativeDeck({...source,parts},value=>nativeInvalid.push(value))).toThrow("invalid-import-slide")
  expect(nativeInvalid).toEqual([{completed:0,total:2},{completed:1,total:2}])
  const nativeValid:unknown[]=[]
  expect(importedNativeDeck(source,value=>nativeValid.push(value))).toEqual(importedNativeDeck(source))
  expect(nativeValid).toEqual(events)
  vi.spyOn(deck,"parseDeck").mockImplementationOnce(()=>{throw new Error("injected-final-deck-validation")})
  const final:unknown[]=[]
  expect(()=>importedDeck(source,value=>final.push(value))).toThrow("injected-final-deck-validation")
  expect(final.at(-1)).toEqual({completed:2,total:2})
  await expect(importPptx(await readFile("fixtures/pptx/hostile-dtd.pptx"))).rejects.toThrow("xml-dtd-forbidden")
})

it("migrates and reopens real stores, fences attempts and retains only monotonic fixed-total progress",async()=>{
  const {store,filename,advance}=await storage(),job=store.submit(owner,"progress",Buffer.from("input")),first=claim(store,job.id)
  const old=new DatabaseSync(filename)
  old.exec("ALTER TABLE operations DROP COLUMN progress_completed; ALTER TABLE operations DROP COLUMN progress_total")
  old.close()
  const reopened=new OperationStore(filename,()=>0)
  try{
    expect(reopened.status(owner,job.id)).toMatchObject({kind:"running",progress:{kind:"unavailable"}})
    expect(()=>reopened.status(other,job.id)).toThrow("not-found")
    expect(reopened.recordProgress(job.id,"wrong",progress(0))).toBe(false)
    for(const value of [progress(0),progress(1),progress(1)])expect(reopened.recordProgress(job.id,first.lease,value)).toBe(true)
    for(const value of [progress(0),progress(2,3),progress(NaN),progress(Infinity),progress(3),progress(-1),progress(.5),progress(Number.MAX_SAFE_INTEGER+1,Number.MAX_SAFE_INTEGER+1)])expect(reopened.recordProgress(job.id,first.lease,value)).toBe(false)
    expect(reopened.status(owner,job.id)).toMatchObject({progress:progress(1)})
  }finally{reopened.close()}
  expect(store.status(owner,job.id)).toMatchObject({kind:"running",progress:progress(1)})
  advance();const recovered=store.recover();expect(recovered).toHaveLength(1)
  expect(store.recordProgress(job.id,first.lease,progress(2))).toBe(false)
  expect(store.status(owner,job.id)).not.toHaveProperty("progress")
  store.acknowledgeCleanup(job.id,first.lease)
  const next=claim(store,job.id)
  expect(next.lease).not.toBe(first.lease)
  expect(store.status(owner,job.id)).toMatchObject({progress:{kind:"unavailable"}})
  expect(store.recordProgress(job.id,first.lease,progress(2))).toBe(false)
  expect(store.recordProgress(job.id,next.lease,progress(0,0))).toBe(true)
  expect(store.recordProgress(job.id,next.lease,progress(0,2))).toBe(false)
})

it.each(["ready","failed","cancelled","expired"])("keeps %s authoritative over buffered progress",async terminal=>{
  const {store,advance}=await storage(),job=store.submit(owner,terminal,Buffer.from("input")),lease=claim(store,job.id).lease
  expect(store.recordProgress(job.id,lease,progress(2))).toBe(true)
  expect(store.status(owner,job.id).kind).toBe("running")
  if(terminal==="failed")store.fail(job.id,lease,"real-diagnostic")
  else if(terminal==="cancelled")store.cancel(owner,job.id)
  else {store.complete(job.id,lease,Buffer.from("result"));if(terminal==="expired")advance(7*86400000+1)}
  expect(store.status(owner,job.id).kind).toBe(terminal)
  expect(store.recordProgress(job.id,lease,progress(2))).toBe(false)
  expect(store.status(owner,job.id)).not.toHaveProperty("progress")
})

it("decodes bounded split UTF8/lines and retains malformed, unknown and ordinary diagnostics",()=>{
  const values:ImportSlideProgress[]=[],decoder=new ImportProgressDecoder(value=>values.push(value))
  const bytes=Buffer.from("ordinary café\n"+importProgressPrefix+JSON.stringify(progress(1))+"\n")
  for(const byte of bytes)decoder.push(Buffer.from([byte]))
  decoder.push(Buffer.from(importProgressPrefix+'{"kind":"unknown","completed":1,"total":2}\n'+importProgressPrefix+'{broken\n'))
  decoder.push(Buffer.from(importProgressPrefix+"x".repeat(200000)+"\n"))
  decoder.push(Buffer.from(importProgressPrefix+JSON.stringify(progress(2))))
  decoder.finish()
  expect(values).toEqual([progress(1),progress(2)])
  expect(decoder.diagnostics()).toContain("oversized-worker-line")
  expect(decoder.diagnostics().length).toBeLessThanOrEqual(2000)
  const diagnostic=new ImportProgressDecoder(()=>{throw new Error("unexpected-frame")})
  diagnostic.push(Buffer.from("ordinary café\n"+importProgressPrefix+"{}\n"));diagnostic.finish()
  expect(diagnostic.diagnostics()).toContain("ordinary café")
  expect(diagnostic.diagnostics()).toContain("invalid-import-progress-frame")
  expect(importSlideProgressSchema.safeParse({...progress(1),owner:"spoof"}).success).toBe(false)
})

it("coalesces backpressure to one latest producer value and drains its final accepted frame",async()=>{
  const chunks:Buffer[]=[],release:(()=>void)[]=[]
  const output=new Writable({highWaterMark:1,write(chunk:Buffer,_encoding,done){chunks.push(Buffer.from(chunk));release.push(done)}})
  const writer=new ImportProgressWriter(output)
  writer.publish(progress(0,10000))
  for(let completed=1;completed<=10000;completed++)writer.publish(progress(completed,10000))
  expect(chunks).toHaveLength(1)
  const first=release.shift();if(!first)throw new Error("write-required");first()
  await Promise.resolve()
  expect(chunks).toHaveLength(2)
  const flushed=writer.flush(),last=release.shift();if(!last)throw new Error("last-write-required");last();await flushed
  expect(chunks.map(value=>JSON.parse(value.toString().slice(importProgressPrefix.length)))).toEqual([progress(0,10000),progress(10000,10000)])
})

it("fences local forwarding, bounds remote in-flight/latest and tolerates failed delivery",async()=>{
  const {store}=await storage(),job=store.submit(owner,"forward",Buffer.from("input")),lease=claim(store,job.id).lease,accepted:ImportSlideProgress[]=[]
  expect(acceptImportProgress(store,job.id,"wrong",progress(1),value=>accepted.push(value))).toBe(false)
  expect(accepted).toEqual([])
  expect(acceptImportProgress(store,job.id,lease,progress(1),value=>accepted.push(value))).toBe(true)
  expect(accepted).toEqual([progress(1)])
  const sent:ImportSlideProgress[]=[],release:(()=>void)[]=[]
  const forwarder=new ImportProgressForwarder(async value=>{sent.push(value);await new Promise<void>(resolve=>release.push(resolve))})
  forwarder.publish(progress(0,10000));for(let value=1;value<=10000;value++)forwarder.publish(progress(value,10000))
  expect(sent).toEqual([progress(0,10000)])
  release.shift()?.();await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve()
  expect(sent).toEqual([progress(0,10000),progress(10000,10000)])
  release.shift()?.();await forwarder.close()
  const failed=new ImportProgressForwarder(async()=>{throw new Error("network-failure")})
  failed.publish(progress(1));await failed.close()
  expect(store.complete(job.id,lease,Buffer.from("unchanged-result"))).toBe(true)
  expect(acceptImportProgress(store,job.id,lease,progress(2),()=>{throw new Error("terminal-forwarded")})).toBe(false)
})

it.each(["container","systemd"])("carries actual importer stderr through %s isolation and preserves final artifacts",async mode=>{
  vi.stubEnv("AIRDESIGN_ISOLATION",mode)
  const {store,root}=await storage(),input=await readFile("fixtures/pptx/native.pptx"),job=store.submit(owner,mode,input),events:ImportSlideProgress[]=[]
  const success=await deliver(store,job.id,root,path.resolve("apps/worker/src/import.ts"),undefined,undefined,value=>events.push(value))
  expect(success,JSON.stringify(store.status(owner,job.id))).toBe(true)
  expect(events.at(-1)).toEqual(progress(2))
  const status=store.status(owner,job.id)
  expect(status.kind).toBe("ready")
  if(status.kind!=="ready")throw new Error("ready-required")
  expect(status.report.deck).toEqual(importedDeck(await importPptx(input)))
  const output=await importPptx(store.artifact(owner,job.id)),source=await importPptx(input)
  for(const [name,bytes] of source.parts)expect(output.parts.get(name)).toEqual(bytes)
})

it("drains real ordinary subprocess stderr before final processing",async()=>{
  const values:ImportSlideProgress[]=[],decoder=new ImportProgressDecoder(value=>values.push(value))
  const child=spawn(process.execPath,["--input-type=module","-e",`process.stderr.write(${JSON.stringify(importProgressPrefix+JSON.stringify(progress(2))+"\n")})`],{stdio:["ignore","ignore","pipe"]})
  child.stderr.on("data",(value:Buffer)=>decoder.push(value))
  expect((await once(child,"close"))[0]).toBe(0)
  decoder.finish();expect(values).toEqual([progress(2)])
})

it("bounds a stalled forwarding request and aborts it without converting progress into job failure",async()=>{
  vi.useFakeTimers()
  try{
    let signal:AbortSignal|undefined
    const forward=new ImportProgressForwarder((_,value)=>{signal=value;return new Promise<void>(()=>{})})
    forward.publish(progress(1))
    const closed=forward.close()
    await vi.advanceTimersByTimeAsync(1000)
    await closed
    expect(signal?.aborted).toBe(true)
  }finally{vi.useRealTimers()}
})
