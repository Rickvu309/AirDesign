import {execFileSync} from "node:child_process"
import {realpathSync} from "node:fs"
import {mkdtemp,mkdir,rm,writeFile,copyFile,readFile} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {expect,it} from "vitest"
import {readRegistry,readBudgetBaseline,validateRegistry,validateIdentity,parseRegistry,scenarioIdentity,mergeBase,seedFiles,fixtureContentHash} from "./registry.ts"

const fixtureRoot=path.join(os.homedir(),"tmp")
function initFixtureRepo(cwd:string,git:(...args:string[])=>string){
  const relative=path.relative(realpathSync(fixtureRoot),realpathSync(cwd))
  expect(relative!==""&&!relative.startsWith("..")&&!path.isAbsolute(relative),"fixture repo must live under the test temp dir").toBe(true)
  git("init","-b","main")
  expect(realpathSync(git("rev-parse","--show-toplevel").trim()),"fixture repo must be its own repository").toBe(realpathSync(cwd))
  git("config","user.name","Design parity history fixture")
  git("config","user.email","design-parity-history@example.invalid")
}

it("refuses to give a fixture identity to a repository outside the test temp dir",()=>{
  expect(()=>initFixtureRepo(process.cwd(),()=>{throw new Error("git must not run outside the temp dir")})).toThrow("fixture repo must live under the test temp dir")
})

it("keeps the merge-base ceiling after an unauthorized increase is committed",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-history-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}})
  try{
    initFixtureRepo(cwd,git)
    await mkdir(path.join(cwd,"bench/design-parity"),{recursive:true})
    const entries=await readRegistry(),entry=entries[0]!
    const save=async(budget:number)=>{
      await writeFile(path.join(cwd,"bench/design-parity/scenarios.json"),JSON.stringify([{...entry,budget}]))
      git("add",".");git("commit","--allow-empty","-m","Record budget")
    }
    await writeFile(path.join(cwd,"bench/design-parity/budget-baseline.json"),JSON.stringify(Object.fromEntries(entries.map(value=>[value.code,1]))))
    await save(0.1)
    git("update-ref","refs/remotes/origin/main","HEAD")
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
    initFixtureRepo(cwd,git)
    await mkdir(path.join(cwd,"bench/design-parity"),{recursive:true})
    for(const file of seedFiles){await mkdir(path.dirname(path.join(cwd,file)),{recursive:true});await copyFile(file,path.join(cwd,file))}
    const entries=(await readRegistry()).map(entry=>({...entry,scenarioChangedBecause:undefined})),first=entries[0]!
    const commit=async(value:unknown)=>{
      await writeFile(path.join(cwd,"bench/design-parity/scenarios.json"),JSON.stringify(value))
      await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(parseRegistry(value).map(scenarioIdentity)))
      git("add",".");git("commit","-m","Record scenarios")
    }
    await commit(entries.map(entry=>entry.code===first.code ? {...entry,viewport:{width:1,height:1}} : entry))
    git("update-ref","refs/remotes/origin/main","HEAD")
    git("checkout","-b","feature")
    git("commit","--allow-empty","-m","Advance feature")
    await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(entries.map(scenarioIdentity)))
    await expect(validateIdentity(entries,cwd,"main")).rejects.toThrow("scenario-changed-without-reason")
    await expect(validateIdentity(entries.map(entry=>({...entry,scenarioChangedBecause:"Reviewed viewport restoration"})),cwd,"main")).resolves.toBeUndefined()
    git("checkout","main")
    const unreachable=entries.find(entry=>entry.status==="unreachable")!
    await commit(entries.map(entry=>entry.code===unreachable.code ? {...entry,status:"reachable",steps:[]} : entry))
    git("update-ref","refs/remotes/origin/main","HEAD")
    git("checkout","-b","coverage")
    git("commit","--allow-empty","-m","Advance feature")
    await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(entries.map(scenarioIdentity)))
    await expect(validateIdentity(entries.map(entry=>({...entry,scenarioChangedBecause:"Cannot remove coverage"})),cwd,"main")).rejects.toThrow("coverage-regressed")
  }finally{await rm(cwd,{recursive:true,force:true})}
})

it("rejects local HEAD and descendants and ignores every CI base override",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-base-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}}).trim()
  const previous={CI:process.env.CI,DESIGN_PARITY_BASE:process.env.DESIGN_PARITY_BASE,GITHUB_BASE_REF:process.env.GITHUB_BASE_REF}
  try{
    initFixtureRepo(cwd,git)
    git("commit","--allow-empty","-m","Reviewed ceiling")
    const base=git("rev-parse","HEAD")
    git("update-ref","refs/remotes/origin/main",base)
    git("update-ref","refs/remotes/origin/release",base)
    git("checkout","-b","feature")
    git("commit","--allow-empty","-m","Raise ceiling")
    const feature=git("rev-parse","HEAD")
    git("commit","--allow-empty","-m","Descendant")
    const descendant=git("rev-parse","HEAD")
    git("checkout","--detach",feature)
    process.env.CI="false"
    process.env.DESIGN_PARITY_BASE="HEAD"
    expect(()=>mergeBase(cwd)).toThrow("unsafe-parity-base")
    expect(()=>mergeBase(cwd,descendant)).toThrow("unsafe-parity-base")
    process.env.CI="true"
    delete process.env.GITHUB_BASE_REF
    expect(mergeBase(cwd)).toBe(base)
    expect(mergeBase(cwd,"missing-override")).toBe(base)
    process.env.GITHUB_BASE_REF="release"
    expect(mergeBase(cwd)).toBe(base)
    git("update-ref","-d","refs/remotes/origin/release")
    expect(()=>mergeBase(cwd)).toThrow()
  }finally{
    for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value
    await rm(cwd,{recursive:true,force:true})
  }
})

it("rejects co-edited seed, unreachable status and budget ceilings after the first reviewed lock lands",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-landed-lock-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}})
  try{
    initFixtureRepo(cwd,git)
    await mkdir(path.join(cwd,"bench/design-parity"),{recursive:true})
    for(const file of seedFiles){await mkdir(path.dirname(path.join(cwd,file)),{recursive:true});await copyFile(file,path.join(cwd,file))}
    const entries=await readRegistry(),entry=entries.find(value=>value.code==="S31.02")!
    await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(entries.map(scenarioIdentity)))
    await writeFile(path.join(cwd,"bench/design-parity/scenarios.json"),JSON.stringify(entries.map(value=>({...value,budget:0.1}))))
    git("add",".");git("commit","-m","First reviewed lock")
    git("update-ref","refs/remotes/origin/main","HEAD")
    git("checkout","-b","feature")
    git("commit","--allow-empty","-m","Change after landing")
    for(const mutation of [{seed:"empty-account"},{status:"unreachable",reason:"bypass"}]){
      const next=parseRegistry(entries.map(value=>value===entry ? {...value,...mutation} : value))
      await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(next.map(scenarioIdentity)))
      await expect(validateIdentity(next,cwd,"main")).rejects.toThrow()
    }
    const reviewed=parseRegistry(entries.map(value=>value===entry ? {...value,seed:"empty-account",scenarioChangedBecause:"Reviewed a new seed change after landing"} : value))
    await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(reviewed.map(scenarioIdentity)))
    await expect(validateIdentity(reviewed,cwd,"main")).resolves.toBeUndefined()
    const fixture=path.join(cwd,"bench/design-parity/capture.mjs")
    await writeFile(fixture,(await readFile(fixture,"utf8")).replace("Project Atlas","Unreviewed title"))
    const changedHash=fixtureContentHash(cwd)
    await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(entries.map(value=>({...scenarioIdentity(value),fixtureContentHash:changedHash}))))
    await expect(validateIdentity(entries,cwd,"main")).rejects.toThrow(/scenario=.*selector=seed:.*check=scenario-changed-without-reason.*expected=.*actual=/)
    const reviewedFixture=entries.map(value=>({...value,scenarioChangedBecause:"Reviewed fixture title revision after landing"}))
    await expect(validateIdentity(reviewedFixture,cwd,"main")).resolves.toBeUndefined()
    await writeFile(path.join(cwd,"bench/design-parity/budget-baseline.json"),JSON.stringify(Object.fromEntries(entries.map(value=>[value.code,1]))))
    await writeFile(path.join(cwd,"bench/design-parity/scenarios.json"),JSON.stringify(entries.map(value=>({...value,budget:1}))))
    const baseline=await readBudgetBaseline(cwd,"main")
    expect(baseline[entry.code]).toBe(0.1)
    expect(()=>validateRegistry([{...entry,budget:1}],[entry.design.split("/").at(-1)!],baseline)).toThrow("budget-raised-without-reason")
  }finally{await rm(cwd,{recursive:true,force:true})}
})
