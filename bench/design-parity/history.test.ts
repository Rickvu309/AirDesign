import {execFileSync} from "node:child_process"
import {realpathSync} from "node:fs"
import {mkdtemp,rm,writeFile,readFile} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {expect,it} from "vitest"
import {readRegistry,readBudgetBaseline,validateRegistry,validateIdentity,parseRegistry,scenarioIdentity,mergeBase,fixtureContentHash} from "./registry.ts"

const fixtureRoot=path.join(os.homedir(),"tmp")
function initFixtureRepo(cwd:string,git:(...args:string[])=>string,scenario:"budget"|"identity"|"base"|"landed-lock"){
  const relative=path.relative(realpathSync(fixtureRoot),realpathSync(cwd))
  expect(relative!==""&&!relative.startsWith("..")&&!path.isAbsolute(relative),"fixture repo must live under the test temp dir").toBe(true)
  git("init","-b","fixture-replay")
  expect(realpathSync(git("rev-parse","--show-toplevel").trim()),"fixture repo must be its own repository").toBe(realpathSync(cwd))
  git("fetch",path.resolve(`bench/design-parity/fixtures/history/${scenario}.bundle`),"refs/heads/*:refs/heads/*")
  git("checkout","reviewed")
  git("update-ref","refs/heads/main","HEAD")
  git("update-ref","refs/remotes/origin/main","HEAD")
}

it("refuses to initialize a repository outside the test temp dir",()=>{
  expect(()=>initFixtureRepo(process.cwd(),()=>{throw new Error("git must not run outside the temp dir")},"base")).toThrow("fixture repo must live under the test temp dir")
})

it("keeps the merge-base ceiling after an unauthorized increase is committed",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-history-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}})
  const ci=process.env.CI
  try{
    process.env.CI="false"
    initFixtureRepo(cwd,git,"budget")
    const entries=await readRegistry(),entry=entries[0]!
    git("checkout","increase")
    const baseline=await readBudgetBaseline(cwd,"main")
    expect(baseline[entry.code]).toBe(0.1)
    expect(()=>validateRegistry([{...entry,budget:0.9}],[entry.design.split("/").at(-1)!],baseline)).toThrow("budget-raised-without-reason")
    git("checkout","repeated")
    expect((await readBudgetBaseline(cwd,"main"))[entry.code]).toBe(0.1)
    const previous=process.env.DESIGN_PARITY_BASE
    try{
      process.env.DESIGN_PARITY_BASE=git("rev-parse","reviewed").trim()
      expect((await readBudgetBaseline(cwd))[entry.code]).toBe(0.1)
    }finally{if(previous===undefined)delete process.env.DESIGN_PARITY_BASE;else process.env.DESIGN_PARITY_BASE=previous}
    await expect(readBudgetBaseline(cwd,"missing-base")).rejects.toThrow()
  }finally{if(ci===undefined)delete process.env.CI;else process.env.CI=ci;await rm(cwd,{recursive:true,force:true})}
})

it("requires identity change reasons and refuses coverage loss even with a reason",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-identity-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}})
  try{
    initFixtureRepo(cwd,git,"identity")
    const entries=(await readRegistry()).map(entry=>({...entry,scenarioChangedBecause:undefined}))
    git("checkout","feature")
    await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(entries.map(scenarioIdentity)))
    await expect(validateIdentity(entries,cwd,"main")).rejects.toThrow("scenario-changed-without-reason")
    await expect(validateIdentity(entries.map(entry=>({...entry,scenarioChangedBecause:"Reviewed viewport restoration"})),cwd,"main")).resolves.toBeUndefined()
    git("checkout","--force","coverage-reviewed")
    git("update-ref","refs/heads/main","HEAD")
    git("update-ref","refs/remotes/origin/main","HEAD")
    git("checkout","coverage")
    await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(entries.map(scenarioIdentity)))
    await expect(validateIdentity(entries.map(entry=>({...entry,scenarioChangedBecause:"Cannot remove coverage"})),cwd,"main")).rejects.toThrow("coverage-regressed")
  }finally{await rm(cwd,{recursive:true,force:true})}
})

it("rejects local HEAD and descendants and ignores every CI base override",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-base-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}}).trim()
  const previous={CI:process.env.CI,DESIGN_PARITY_BASE:process.env.DESIGN_PARITY_BASE,GITHUB_BASE_REF:process.env.GITHUB_BASE_REF}
  try{
    initFixtureRepo(cwd,git,"base")
    const base=git("rev-parse","reviewed")
    git("update-ref","refs/remotes/origin/release",base)
    const feature=git("rev-parse","feature")
    const descendant=git("rev-parse","descendant")
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
    initFixtureRepo(cwd,git,"landed-lock")
    const entries=await readRegistry(),entry=entries.find(value=>value.code==="S31.02")!
    git("checkout","feature")
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
