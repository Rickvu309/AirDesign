import {execFileSync} from "node:child_process"
import {mkdtemp,mkdir,rm,writeFile} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {expect,it} from "vitest"
import {readRegistry,readBudgetBaseline,validateRegistry,validateIdentity,parseRegistry,scenarioIdentity} from "./registry.ts"

it("keeps the merge-base ceiling after an unauthorized increase is committed",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-history-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}})
  try{
    git("init","-b","main")
    await mkdir(path.join(cwd,"bench/design-parity"),{recursive:true})
    const entries=await readRegistry(),entry=entries[0]!
    const save=async(budget:number)=>{
      await writeFile(path.join(cwd,"bench/design-parity/scenarios.json"),JSON.stringify([{...entry,budget}]))
      git("add",".");git("commit","--allow-empty","-m","Record budget")
    }
    await save(0.1)
    git("checkout","-b","feature")
    await save(0.9)
    const baseline=await readBudgetBaseline(cwd,"main")
    expect(baseline[entry.code]).toBe(0.1)
    expect(()=>validateRegistry([{...entry,budget:0.9}],[entry.design.split("/").at(-1)!],baseline)).toThrow("budget-raised-without-reason")
    await save(0.9)
    expect((await readBudgetBaseline(cwd,"main"))[entry.code]).toBe(0.1)
    const previous=process.env.DESIGN_PARITY_BASE
    try{
      process.env.DESIGN_PARITY_BASE=git("rev-parse","main").trim()
      expect((await readBudgetBaseline(cwd))[entry.code]).toBe(0.1)
    }finally{if(previous===undefined)delete process.env.DESIGN_PARITY_BASE;else process.env.DESIGN_PARITY_BASE=previous}
    await expect(readBudgetBaseline(cwd,"missing-base")).rejects.toThrow()
  }finally{await rm(cwd,{recursive:true,force:true})}
})

it("requires identity change reasons and refuses coverage loss even with a reason",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-identity-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}})
  try{
    git("init","-b","main")
    await mkdir(path.join(cwd,"bench/design-parity"),{recursive:true})
    const entries=await readRegistry(),first=entries[0]!
    const commit=async(value:unknown)=>{
      await writeFile(path.join(cwd,"bench/design-parity/scenarios.json"),JSON.stringify(value))
      await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(parseRegistry(value).map(scenarioIdentity)))
      git("add",".");git("commit","-m","Record scenarios")
    }
    await commit(entries.map(entry=>entry.code===first.code ? {...entry,viewport:{width:1,height:1}} : entry))
    git("checkout","-b","feature")
    await expect(validateIdentity(entries,cwd,"main")).rejects.toThrow("scenario-changed-without-reason")
    await expect(validateIdentity(entries.map(entry=>({...entry,scenarioChangedBecause:"Reviewed viewport restoration"})),cwd,"main")).resolves.toBeUndefined()
    git("checkout","main")
    const unreachable=entries.find(entry=>entry.status==="unreachable")!
    await commit(entries.map(entry=>entry.code===unreachable.code ? {...entry,status:"reachable",steps:[]} : entry))
    git("checkout","feature")
    git("merge","--ff-only","main")
    await expect(validateIdentity(entries.map(entry=>({...entry,scenarioChangedBecause:"Cannot remove coverage"})),cwd,"main")).rejects.toThrow("coverage-regressed")
  }finally{await rm(cwd,{recursive:true,force:true})}
})
