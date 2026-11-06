import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {expect,it} from "vitest"

const execute=promisify(execFile)
it("rejects an unlisted address before opening a database or requiring other credentials",async()=>{
  await expect(execute(process.execPath,["apps/server/src/smoke/mint-link.ts","person@example.com"],{env:{...process.env,AIRDESIGN_SMOKE_EMAILS:"smoke@example.com",AIRDESIGN_DATABASE_URL:"",DATABASE_URL:"",AIRDESIGN_SECRET:"",AIRDESIGN_PUBLIC_ORIGIN:""},maxBuffer:8192})).rejects.toThrow("smoke-email-not-allowlisted")
})
it("disables CLI minting when the allowlist is absent",async()=>{
  await expect(execute(process.execPath,["apps/server/src/smoke/mint-link.ts","smoke@example.com"],{env:{...process.env,AIRDESIGN_SMOKE_EMAILS:"",AIRDESIGN_DATABASE_URL:"",DATABASE_URL:"",AIRDESIGN_SECRET:"",AIRDESIGN_PUBLIC_ORIGIN:""},maxBuffer:8192})).rejects.toThrow("smoke-email-not-allowlisted")
})
