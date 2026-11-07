import {createHash} from "node:crypto"
import {readFileSync} from "node:fs"
import {readFile} from "node:fs/promises"
import {execFileSync,spawnSync} from "node:child_process"
import {isDeepStrictEqual} from "node:util"
import {z} from "zod"
import {surfaceTargets,targetFor} from "./targets.ts"
const namedStep=z.object({kind:z.enum(["click","keyboard-activate","dialog-click","hover"]),name:z.string().min(1)})
const fieldStep=z.object({kind:z.enum(["fill","select"]),label:z.string().min(1),value:z.string()})
const stepSchema=z.union([namedStep,fieldStep,z.object({kind:z.literal("wait-text"),text:z.string().min(1)}),z.object({kind:z.literal("selector-click"),selector:z.string().min(1)}),z.object({kind:z.literal("import"),outcome:z.enum(["queued","failed"])}),z.object({kind:z.literal("agent"),outcome:z.enum(["working","complete","failed","long-message","remote","limited"])}),z.object({kind:z.enum(["offline","pay","expire-payment","export-failed"])})])
const control=z.object({role:z.enum(["button","link","heading","textbox","combobox","spinbutton"]),name:z.string().min(1)})
const textRole=z.object({selector:z.string().min(1),role:z.enum(["landing-hero","pricing-title","page-title","dialog-title","module-title","body","helper"]),color:z.enum(["ink","gray.600","gray.500"]),minimumContrast:z.number().min(1).max(21)})
const structure=z.object({icons:z.array(z.object({region:z.string().min(1),name:z.string().regex(/^[a-z][a-z-]+$/),size:z.number().int().positive(),color:z.enum(["ink","gray.600","gray.500"])})),textRoles:z.array(textRole).min(1)})
const assertions=z.object({structure,copyKeys:z.array(z.string().min(1)),entryCopyKeys:z.array(z.string().min(1)).optional(),texts:z.array(z.string().min(1)),controls:z.array(control).min(1),probe:z.discriminatedUnion("kind",[z.object({kind:z.literal("fill"),label:z.string(),value:z.string()}),z.object({kind:z.literal("dialog"),open:z.string(),title:z.string(),close:z.string()}),z.object({kind:z.literal("view")}),z.object({kind:z.literal("navigate"),name:z.string(),path:z.string()}),z.object({kind:z.literal("expired")}),z.object({kind:z.literal("approval")})])}).refine(value=>value.copyKeys.length+(value.entryCopyKeys?.length??0)>0,"missing-copy-assertion")
const common={code:z.string().regex(/^S[0-9]{2}\.[0-9]{2}$/),design:z.string(),viewport:z.object({width:z.number().int().positive(),height:z.number().int().positive()}),seed:z.enum(["signed-out","empty-account","recents","trash-with-items","deck-open","usage-active","usage-active-connected","deck-limited","deck-limited-with-credits","oauth-Claude","oauth-Codex"]),metric:z.literal("local-oklab-v2"),target:z.number().min(0).max(1),budget:z.number().min(0).max(1),budgetRaisedBecause:z.string().optional(),scenarioChangedBecause:z.string().optional(),assertions}
const surface=z.discriminatedUnion("surface",[z.object({surface:z.literal("site"),route:z.string().startsWith("/")}),z.object({surface:z.literal("studio"),route:z.string().startsWith("/")})])
const scenarioSchema=z.intersection(surface,z.discriminatedUnion("status",[z.object({...common,status:z.literal("reachable"),steps:z.array(stepSchema)}),z.object({...common,status:z.literal("unreachable"),reason:z.string().min(1)})]))
export type Step=z.infer<typeof stepSchema>
export type Scenario=z.infer<typeof scenarioSchema>
export function parseRegistry(value:unknown):Scenario[]{return z.array(scenarioSchema).parse(value)}
export async function readRegistry():Promise<Scenario[]> {
  const calibration=z.object({metric:z.literal("local-oklab-v2"),targets:z.object({site:z.number(),studio:z.number()})}).parse(JSON.parse(await readFile(new URL("./calibration.json",import.meta.url),"utf8")))
  if(calibration.targets.site!==surfaceTargets.site||calibration.targets.studio!==surfaceTargets.studio)throw new Error("target-calibration-mismatch")
  return parseRegistry(JSON.parse(await readFile(new URL("./scenarios.json",import.meta.url),"utf8")))
}
export function mergeBase(cwd=process.cwd(),target?:string):string {
  const ci=process.env.CI==="true"
  const reference=ci ? `origin/${process.env.GITHUB_BASE_REF||"main"}` : target??process.env.DESIGN_PARITY_BASE??"origin/main"
  if(!ci&&(target!==undefined||process.env.DESIGN_PARITY_BASE!==undefined)&&spawnSync("git",["merge-base","--is-ancestor","HEAD",reference],{cwd,stdio:"pipe"}).status===0)throw new Error("unsafe-parity-base")
  return execFileSync("git",["merge-base","HEAD",reference],{cwd,encoding:"utf8",stdio:"pipe"}).trim()
}
function baseFile(file:string,cwd:string,target?:string):string|undefined {
  const base=mergeBase(cwd,target)
  const exists=execFileSync("git",["ls-tree","--name-only",base,"--",file],{cwd,encoding:"utf8"}).trim()
  return exists ? execFileSync("git",["show",`${base}:${file}`],{cwd,encoding:"utf8"}) : undefined
}
export async function readBudgetBaseline(cwd=process.cwd(),target?:string):Promise<Record<string,number>> {
  const baseline:Record<string,number>=JSON.parse(await readFile(`${cwd}/bench/design-parity/budget-baseline.json`,"utf8"))
  const source=baseFile("bench/design-parity/scenarios.json",cwd,target)
  if(source)for(const entry of z.array(z.object({code:z.string(),metric:z.string().optional(),budget:z.number()})).parse(JSON.parse(source)).filter(entry=>entry.metric==="local-oklab-v2"))baseline[entry.code]=Math.min(baseline[entry.code]??1,entry.budget)
  return baseline
}
export const seedFiles=["bench/design-parity/capture.mjs","bench/design-parity/investor-deck.ts","bench/design-parity/approval-fixture.ts","bench/design-parity/fixture-environment.ts","bench/design-parity/fixture-identifiers.ts","bench/agent-account/fixture.mjs","packages/deck/src/fixture.ts"]
export function fixtureContentHash(cwd=process.cwd()){
  const hash=createHash("sha256")
  for(const file of seedFiles)hash.update(file).update("\0").update(readFileSync(`${cwd}/${file}`)).update("\0")
  return hash.digest("hex")
}
export function scenarioIdentity(entry:Scenario){
  return {fixtureContentHash:fixtureContentHash(),code:entry.code,seed:entry.seed,steps:entry.status==="reachable" ? entry.steps : [],viewport:entry.viewport,surface:entry.surface,route:entry.route,status:entry.status,assertions:entry.assertions}
}
export async function validateIdentity(entries:Scenario[],cwd=process.cwd(),target?:string):Promise<void>{
  const lock=z.array(z.object({code:z.string()}).passthrough()).parse(JSON.parse(await readFile(`${cwd}/bench/design-parity/scenario-lock.json`,"utf8")))
  const fixtureHash=fixtureContentHash(cwd)
  const identities=entries.map(entry=>({...scenarioIdentity(entry),fixtureContentHash:fixtureHash}))
  for(const [index,identity] of identities.entries())if(!isDeepStrictEqual(identity,lock[index]))throw new Error(`scenario=${identity.code} selector=seed:${identity.seed} check=scenario-lock-mismatch expected=${JSON.stringify(lock[index])} actual=${JSON.stringify(identity)}`)
  if(identities.length!==lock.length)throw new Error(`scenario=registry selector=scenario-lock.json check=scenario-lock-mismatch expected=${lock.length} actual=${identities.length}`)
  const priorRegistry=baseFile("bench/design-parity/scenarios.json",cwd,target)
  const source=baseFile("bench/design-parity/scenario-lock.json",cwd,target)??priorRegistry
  if(!source)return
  const priorReasons=new Map(z.array(z.object({code:z.string(),scenarioChangedBecause:z.string().optional()})).parse(JSON.parse(priorRegistry??"[]")).map(entry=>[entry.code,entry.scenarioChangedBecause?.trim()]))
  const prior=z.array(z.object({code:z.string(),status:z.string()}).passthrough()).parse(JSON.parse(source))
  for(const previous of prior){
    const current=entries.find(entry=>entry.code===previous.code)
    if(!current||previous.status==="reachable"&&current.status!=="reachable")throw new Error(`scenario=${previous.code} selector=scenarios.json check=coverage-regressed expected=${previous.status} actual=${current?.status??"missing"}`)
    const identity={...scenarioIdentity(current),fixtureContentHash:fixtureHash}
    if(Object.entries(previous).some(([key,value])=>key in identity&&!isDeepStrictEqual(value,Reflect.get(identity,key)))&&(!current.scenarioChangedBecause?.trim()||current.scenarioChangedBecause.trim()===priorReasons.get(current.code)))throw new Error(`scenario=${current.code} selector=seed:${current.seed} check=scenario-changed-without-reason expected="fresh scenarioChangedBecause" actual=${JSON.stringify(current.scenarioChangedBecause??null)}`)
  }
}
export function validateRegistry(entries:Scenario[],images:string[],baseline:Record<string,number>):void {
  if(new Set(entries.map(entry=>entry.code)).size!==entries.length)throw new Error("duplicate-screen")
  if(entries.length!==images.length||images.some(image=>!entries.some(entry=>entry.design.endsWith("/"+image))))throw new Error("screen-coverage")
  for(const entry of entries){
    if(entry.target!==targetFor(entry.code,entry.surface))throw new Error("uncalibrated-target")
    if(!entry.design.split("/").at(-1)?.startsWith(entry.code+"-"))throw new Error("screen-image-mismatch")
    if(!entry.design.endsWith(".png")||!entry.design.startsWith("docs/design/v0.1/screens/"))throw new Error("invalid-design-path")
    if(!Number.isFinite(entry.budget)||entry.budget<0||entry.budget>1)throw new Error("invalid-budget")
    if(baseline[entry.code]===undefined)throw new Error("missing-baseline")
    if(entry.budget>baseline[entry.code]!&&!entry.budgetRaisedBecause?.trim())throw new Error("budget-raised-without-reason")
    if(entry.status==="unreachable"&&!entry.reason.trim())throw new Error("missing-unreachable-reason")
  }
}
export function ratchet(budget:number,ratio:number):number {
  if(!Number.isFinite(ratio)||ratio<0||ratio>1)throw new Error("invalid-ratio")
  return Math.min(budget,Math.ceil(ratio*1000000)/1000000)
}
export function selectScenarios(entries:Scenario[],only:string|undefined):Scenario[]{
  if(!only)return entries
  const codes=only.split(",")
  if(codes.some(code=>!entries.some(entry=>entry.code===code)))throw new Error("unknown-screen")
  return entries.filter(entry=>codes.includes(entry.code))
}
export function passesParity(entry:Scenario,score:number|undefined,strict:boolean):boolean {
  return entry.status==="reachable"&&score!==undefined&&Number.isFinite(score)&&score<=entry.budget&&(!strict||score<=targetFor(entry.code,entry.surface)&&entry.target===targetFor(entry.code,entry.surface))
}
