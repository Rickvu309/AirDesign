import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {it} from "vitest"

it("captures responsive pictures without media switches and restores the viewport on errors",async()=>{
  await promisify(execFile)(process.execPath,["--test","tests/live/picture-shot.browser.mjs"],{env:process.env,timeout:60000,maxBuffer:32768})
},65000)
