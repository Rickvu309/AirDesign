import {execFileSync,spawnSync} from "node:child_process"
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {expect,it} from "vitest"
it("rejects the original missing fixture import and accepts the complete capture module",async()=>{
  const directory=await mkdtemp(path.join(os.homedir(),"tmp/parity-lint-")),file=path.join(directory,"capture.mjs"),config=path.resolve("bench/design-parity/oxlint.json"),lint=path.resolve("node_modules/.bin/oxlint")
  try{
    const source=await readFile("bench/design-parity/capture.mjs","utf8")
    await writeFile(file,source.replace(/^import \{fixtureDeck\}[^\n]+\n/m,""))
    const rejected=spawnSync(lint,["-c",config,file],{encoding:"utf8"})
    expect(rejected.status).toBe(1)
    expect(rejected.stdout+rejected.stderr).toContain("fixtureDeck")
    expect(rejected.stdout+rejected.stderr).toContain("no-undef")
    await writeFile(file,source)
    expect(()=>execFileSync(lint,["-c",config,file],{stdio:"pipe"})).not.toThrow()
  }finally{await rm(directory,{recursive:true,force:true})}
})
