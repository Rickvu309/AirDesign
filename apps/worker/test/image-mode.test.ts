import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {mkdtemp,rm} from "node:fs/promises"
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
