import {execFileSync} from "node:child_process"
import {realpathSync} from "node:fs"
import {mkdtemp,rm,writeFile,readFile} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {afterEach,beforeEach,expect,it,vi} from "vitest"
import {readRegistry,readBudgetBaseline,validateRegistry,validateIdentity,parseRegistry,scenarioIdentity,mergeBase,fixtureContentHash,type Scenario} from "./registry.ts"
import * as registry from "./registry.ts"

const fixtureRoot=path.join(os.homedir(),"tmp")
beforeEach(()=>{
  vi.stubEnv("CI","false")
  vi.stubEnv("DESIGN_PARITY_BASE",undefined)
  vi.stubEnv("GITHUB_BASE_REF",undefined)
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()})

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

async function readReplayRegistry(cwd:string){
  return parseRegistry(JSON.parse(await readFile(path.join(cwd,"bench/design-parity/scenarios.json"),"utf8")))
}

async function writeReplayLock(cwd:string,entries:Scenario[]){
  const fixtureHash=fixtureContentHash(cwd)
  await writeFile(path.join(cwd,"bench/design-parity/scenario-lock.json"),JSON.stringify(entries.map(entry=>({...scenarioIdentity(entry),fixtureContentHash:fixtureHash}))))
}

it("refuses to initialize a repository outside the test temp dir",()=>{
  expect(()=>initFixtureRepo(os.homedir(),()=>{throw new Error("git must not run outside the temp dir")},"base")).toThrow("fixture repo must live under the test temp dir")
})

it("keeps the merge-base ceiling after an unauthorized increase is committed",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-history-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}})
  const ci=process.env.CI
  try{
    process.env.CI="false"
    initFixtureRepo(cwd,git,"budget")
    const entries=await readReplayRegistry(cwd),entry=entries[0]
    if(!entry)throw new Error("missing-budget-fixture-entry")
    git("checkout","increase")
    const baseline=await readBudgetBaseline(cwd,"main")
    expect(baseline[entry.code]).toBe(0.1)
    expect(()=>validateRegistry([{...entry,budget:0.9}],[path.basename(entry.design)],baseline)).toThrow("budget-raised-without-reason")
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
    git("checkout","feature")
    const entries=await readReplayRegistry(cwd),entry=entries[0]
    if(!entry)throw new Error("missing-identity-fixture-entry")
    await expect(validateIdentity(entries,cwd,"main")).resolves.toBeUndefined()
    const changed=entries.map(value=>value===entry ? {...value,viewport:{...value.viewport,width:value.viewport.width+1}} : value)
    await writeReplayLock(cwd,changed)
    await expect(validateIdentity(changed,cwd,"main")).rejects.toThrow(`scenario=${entry.code} selector=seed:${entry.seed} check=scenario-changed-without-reason`)
    const reviewed=changed.map(value=>({...value,scenarioChangedBecause:"Reviewed viewport restoration"}))
    await expect(validateIdentity(reviewed,cwd,"main")).resolves.toBeUndefined()
    git("checkout","--force","coverage-reviewed")
    git("update-ref","refs/heads/main","HEAD")
    git("update-ref","refs/remotes/origin/main","HEAD")
    git("checkout","coverage")
    const coverage=await readReplayRegistry(cwd),reachable=coverage.find(value=>value.status==="reachable")
    if(!reachable)throw new Error("missing-reachable-fixture-entry")
    await expect(validateIdentity(coverage,cwd,"main")).resolves.toBeUndefined()
    const removed=coverage.filter(value=>value!==reachable).map(value=>({...value,scenarioChangedBecause:"Cannot remove coverage"}))
    await writeReplayLock(cwd,removed)
    await expect(validateIdentity(removed,cwd,"main")).rejects.toThrow(`scenario=${reachable.code} selector=scenarios.json check=coverage-regressed`)
  }finally{await rm(cwd,{recursive:true,force:true})}
})

it("owns replay inputs despite independent caller registry and fixture hash drift",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-independent-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe",env:{...process.env,TMPDIR:path.join(os.homedir(),"tmp")}})
  try{
    initFixtureRepo(cwd,git,"identity")
    git("checkout","feature")
    const baseline=parseRegistry(JSON.parse(await readFile(path.join(cwd,"bench/design-parity/scenarios.json"),"utf8")))
    await expect(validateIdentity(baseline,cwd,"main")).resolves.toBeUndefined()
    const callerEntries=(await readRegistry()).map(value=>({...value,viewport:{...value.viewport,width:value.viewport.width+37}}))
    const callerRegistry=vi.spyOn(registry,"readRegistry").mockResolvedValue(callerEntries)
    const entries=await readReplayRegistry(cwd)
    expect(entries).toEqual(baseline)
    expect(entries).not.toEqual(callerEntries)
    expect(callerRegistry).not.toHaveBeenCalled()
    const identity=scenarioIdentity
    const callerIdentity=vi.spyOn(registry,"scenarioIdentity").mockImplementation(entry=>({...identity(entry),fixtureContentHash:fixtureContentHash(cwd)}))
    await writeReplayLock(cwd,entries)
    await expect(validateIdentity(entries,cwd,"main")).resolves.toBeUndefined()
    callerIdentity.mockImplementation(entry=>({...identity(entry),fixtureContentHash:"caller-workspace-fixture-drift"}))
    await writeReplayLock(cwd,entries)
    await expect(validateIdentity(entries,cwd,"main")).resolves.toBeUndefined()
    const first=entries[0]
    if(!first)throw new Error("missing-independent-fixture-entry")
    const changed=entries.map(value=>value===first ? {...value,viewport:{...value.viewport,width:value.viewport.width+1}} : value)
    await writeReplayLock(cwd,changed)
    await expect(validateIdentity(changed,cwd,"main")).rejects.toThrow(`scenario=${first.code} selector=seed:${first.seed} check=scenario-changed-without-reason`)
    await expect(validateIdentity(changed.map(value=>({...value,scenarioChangedBecause:"Reviewed independent replay viewport"})),cwd,"main")).resolves.toBeUndefined()
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
    git("checkout","feature")
    const entries=await readReplayRegistry(cwd),entry=entries.find(value=>value.code==="S31.02")
    if(!entry)throw new Error("missing-landed-fixture-entry")
    await expect(validateIdentity(entries,cwd,"main")).resolves.toBeUndefined()
    for(const mutation of [
      {change:{seed:"empty-account"},check:`scenario=${entry.code} selector=seed:empty-account check=scenario-changed-without-reason`},
      {change:{status:"unreachable",reason:"bypass",scenarioChangedBecause:"Reviewed reason cannot remove coverage"},check:`scenario=${entry.code} selector=scenarios.json check=coverage-regressed`}
    ]){
      await writeReplayLock(cwd,entries)
      await expect(validateIdentity(entries,cwd,"main")).resolves.toBeUndefined()
      const next=parseRegistry(entries.map(value=>value===entry ? {...value,...mutation.change} : value))
      await writeReplayLock(cwd,next)
      await expect(validateIdentity(next,cwd,"main")).rejects.toThrow(mutation.check)
    }
    const reviewed=parseRegistry(entries.map(value=>value===entry ? {...value,seed:"empty-account",scenarioChangedBecause:"Reviewed a new seed change after landing"} : value))
    await writeReplayLock(cwd,reviewed)
    await expect(validateIdentity(reviewed,cwd,"main")).resolves.toBeUndefined()
    await writeReplayLock(cwd,entries)
    await expect(validateIdentity(entries,cwd,"main")).resolves.toBeUndefined()
    const fixture=path.join(cwd,"bench/design-parity/capture.mjs"),original=await readFile(fixture,"utf8")
    const changed=original.replace("Project Atlas","Unreviewed title")
    expect(changed).not.toBe(original)
    await writeFile(fixture,changed)
    await writeReplayLock(cwd,entries)
    await expect(validateIdentity(entries,cwd,"main")).rejects.toThrow(/scenario=S11.01 selector=seed:signed-out check=scenario-changed-without-reason.*expected=.*actual=/)
    const reviewedFixture=entries.map(value=>({...value,scenarioChangedBecause:"Reviewed fixture title revision after landing"}))
    await expect(validateIdentity(reviewedFixture,cwd,"main")).resolves.toBeUndefined()
    await writeFile(path.join(cwd,"bench/design-parity/budget-baseline.json"),JSON.stringify(Object.fromEntries(entries.map(value=>[value.code,value.budget]))))
    const baseline=await readBudgetBaseline(cwd,"main")
    expect(baseline[entry.code]).toBe(0.1)
    expect(()=>validateRegistry([entry],[path.basename(entry.design)],baseline)).not.toThrow()
    await writeFile(path.join(cwd,"bench/design-parity/budget-baseline.json"),JSON.stringify(Object.fromEntries(entries.map(value=>[value.code,1]))))
    await writeFile(path.join(cwd,"bench/design-parity/scenarios.json"),JSON.stringify(entries.map(value=>({...value,budget:1}))))
    const capped=await readBudgetBaseline(cwd,"main")
    expect(capped[entry.code]).toBe(0.1)
    expect(()=>validateRegistry([{...entry,budget:1}],[path.basename(entry.design)],capped)).toThrow("budget-raised-without-reason")
  }finally{await rm(cwd,{recursive:true,force:true})}
})
