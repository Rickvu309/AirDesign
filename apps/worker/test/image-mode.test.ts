import sharp from "sharp"
import {OperationStore} from "../../../packages/operations/src/index.ts"
import {imageJob} from "../../../packages/files/src/assets/image-job.ts"
import {uploadProvenance} from "../../../packages/files/src/assets/provenance.ts"
import {readValidatedImage} from "../../../packages/files/src/assets/validate.ts"
import {deliver} from "../src/isolation.ts"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {mkdtemp,rm,readdir} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {expect,it} from "vitest"
it("drains the image queue independently of the export database",async()=>{
  const folder=await mkdtemp(path.join(os.homedir(),"tmp/p06-image-worker-"))
  try{
    const result=await promisify(execFile)(process.execPath,["apps/worker/src/main.ts","images"],{timeout:10000,env:{...process.env,AIRDESIGN_DATABASE_URL:"postgresql://localhost:1/unavailable",AIRDESIGN_OPERATIONS_PATH:path.join(folder,"operations.sqlite"),AIRDESIGN_WORKER_TEMP:path.join(folder,"jobs")}})
    expect(result.stdout).toBe("")
  }finally{await rm(folder,{recursive:true,force:true})}
})

it("delivers an EXIF-6 80 MP photo within the production isolation envelope",async()=>{
  const folder=await mkdtemp(path.join(os.homedir(),"tmp/p06-image-memory-")),store=new OperationStore(path.join(folder,"operations.sqlite")),owner={personId:"large-image-owner"}
  try{
    const bytes=await sharp({create:{width:10000,height:8000,channels:3,background:"blue"}}).jpeg().withMetadata({orientation:6}).toBuffer()
    const job=store.submit(owner,"oriented-80mp",imageJob(bytes,uploadProvenance))
    const delivered=await deliver(store,job.id,folder,path.resolve("apps/worker/src/validate-image.ts"))
    expect(store.status(owner,job.id),JSON.stringify(store.status(owner,job.id))).toMatchObject({kind:"ready"})
    expect(delivered).toBe(true)
    const image=readValidatedImage(store.artifact(owner,job.id)),full=await sharp(Buffer.from(image.exportImage,"base64")).metadata(),preview=await sharp(Buffer.from(image.normalized,"base64")).metadata(),thumbnail=await sharp(Buffer.from(image.thumbnail,"base64")).metadata()
    expect(Buffer.from(image.original,"base64")).toEqual(bytes)
    expect([full.width,full.height,full.orientation]).toEqual([8000,10000,undefined])
    expect([preview.width,preview.height]).toEqual([3277,4096])
    expect([thumbnail.width,thumbnail.height]).toEqual([410,512])
    expect((await readdir(folder,{withFileTypes:true})).filter(entry=>entry.isDirectory())).toEqual([])
  }finally{store.close();await rm(folder,{recursive:true,force:true})}
},30000)
