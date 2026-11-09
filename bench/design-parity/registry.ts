import {createHash} from "node:crypto"
import {readFileSync} from "node:fs"
import {readFile} from "node:fs/promises"
import {execFileSync,spawnSync} from "node:child_process"
import {isDeepStrictEqual} from "node:util"
import {z} from "zod"
import {targetFor,componentTargets,calibrationFor,sourceFloors} from "./targets.ts"
import {sourceVerdict} from "./source-floor.mjs"
const copyKit=z.record(z.string(),z.unknown()).parse(JSON.parse(readFileSync(new URL("../../docs/design/v0.1/copy-kit.json",import.meta.url),"utf8")))
const copyKey=z.string().refine(key=>typeof copyKit[key]==="string","required-copy-must-use-copy-kit-key")
export function resolveCopy(key:string,values:Record<string,string>={}):string{
  const template=z.string().parse(copyKit[copyKey.parse(key)])
  return template.replace(/\{([^}]+)\}/g,(_match,name:string)=>{
    const value=values[name]
    if(value===undefined)throw new Error(`missing-copy-value:${key}:${name}`)
    return value
  })
}
const componentBox=z.object({left:z.number().int().nonnegative(),top:z.number().int().nonnegative(),width:z.number().int().positive(),height:z.number().int().positive()})
const component=z.object({kind:z.enum(["dialog","toast"]),selector:z.string().min(1),designBox:componentBox,target:z.number().min(0).max(1)})
const namedStep=z.object({kind:z.enum(["click","keyboard-activate","dialog-click","hover"]),name:z.string().min(1)})
const fieldStep=z.object({kind:z.enum(["fill","select"]),label:z.string().min(1),value:z.string()})
const stepSchema=z.union([z.object({kind:z.literal("hold"),name:z.literal("New slide")}).strict(),z.object({kind:z.literal("paste-slides"),count:z.literal(2)}).strict(),namedStep,fieldStep,z.object({kind:z.literal("wait-text"),text:z.string().min(1)}),z.object({kind:z.literal("selector-click"),selector:z.string().min(1)}),z.object({kind:z.literal("import"),outcome:z.enum(["queued","failed"])}),z.object({kind:z.literal("agent"),outcome:z.enum(["working","complete","failed","long-message","remote","limited"])}),z.object({kind:z.enum(["offline","pay","expire-payment","export-failed","export-download","checkout-failed"])})])
const control=z.discriminatedUnion("role",[z.object({role:z.literal("combobox"),nameKey:copyKey,value:z.string().min(1)}).strict(),z.object({role:z.enum(["button","link","heading","textbox","spinbutton"]),nameKey:copyKey,owner:z.enum(["manual-editor","editor-shell","aira-panel","images-panel","slide-navigation","header","footer"]).optional(),paint:z.enum(["icon","keyboard-focus"]).optional()}).strict(),z.object({role:z.literal("searchbox"),name:z.literal("Search")}).strict()])
const textAppearance={color:z.enum(["ink","gray.600","gray.500","white"]),minimumContrast:z.number().min(1).max(21)}
const textRole=z.union([z.object({selector:z.string().min(1),role:z.enum(["landing-hero","pricing-title","page-title","consent-title","access-error-title","dialog-title","module-title","body","helper"]),...textAppearance}).strict(),z.object({componentSelector:z.literal("h2"),role:z.literal("dialog-title"),...textAppearance}).strict()])
const structure=z.object({dialogActions:z.object({primaryKey:copyKey,cancelKey:copyKey}).optional(),icons:z.array(z.object({region:z.string().min(1),name:z.string().regex(/^[a-z][a-z-]+$/),size:z.number().int().positive(),color:z.enum(["ink","gray.600","gray.500"])})),textRoles:z.array(textRole).min(1)})
const assertions=z.object({structure,copyKeys:z.array(copyKey),copyOwners:z.record(copyKey,z.enum(["toast","aira-panel","editor-shell","actions-search"])).optional(),entryCopyKeys:z.array(copyKey).optional(),entryControls:z.array(control).optional(),copyValues:z.record(z.string(),z.string()).optional(),controls:z.array(control),probe:z.discriminatedUnion("kind",[z.object({kind:z.literal("fill"),label:z.string(),value:z.string()}),z.object({kind:z.literal("dialog"),open:z.string(),titleKey:copyKey,close:z.string()}).strict(),z.object({kind:z.literal("view")}),z.object({kind:z.literal("navigate"),name:z.string(),path:z.string(),owner:z.literal("header").optional()}),z.object({kind:z.literal("expired")}),z.object({kind:z.literal("approval")})])}).strict().refine(value=>!value.copyOwners||Object.keys(value.copyOwners).length===value.copyKeys.length&&value.copyKeys.every(key=>Object.hasOwn(value.copyOwners??{},key)),"copy-owner-coverage").refine(value=>value.copyKeys.length+(value.entryCopyKeys?.length??0)+(value.entryControls?.length??0)>0,"missing-copy-assertion")
const common={component:component.optional(),code:z.string().regex(/^S[0-9]{2}\.[0-9]{2}$/),design:z.string(),viewport:z.object({width:z.number().int().positive(),height:z.number().int().positive()}),seed:z.enum(["signed-out","empty-account","recents","trash-with-items","deck-open","usage-active","usage-active-connected","deck-limited","deck-limited-with-credits","oauth-Claude","oauth-Codex"]),metric:z.literal("local-oklab-v2"),target:z.number().min(0).max(1),budget:z.number().min(0).max(1),budgetRaisedBecause:z.string().optional(),scenarioChangedBecause:z.string().optional(),assertions}
const surface=z.discriminatedUnion("surface",[z.object({surface:z.literal("site"),route:z.string().startsWith("/")}),z.object({surface:z.literal("studio"),route:z.string().startsWith("/")})])
const scenarioSchema=z.intersection(surface,z.discriminatedUnion("status",[z.object({...common,status:z.literal("reachable"),steps:z.array(stepSchema)}),z.object({...common,status:z.literal("unreachable"),reason:z.string().min(1)})])).refine(entry=>entry.assertions.controls.length>0||entry.component?.kind==="toast","missing-required-control").refine(entry=>!Object.values(entry.assertions.copyOwners??{}).includes("toast")||entry.component?.kind==="toast","copy-toast-component")
export type Step=z.infer<typeof stepSchema>
export type Scenario=z.infer<typeof scenarioSchema>
export function parseRegistry(value:unknown):Scenario[]{return z.array(scenarioSchema).parse(value)}
export async function readRegistry():Promise<Scenario[]> {
  const entries=parseRegistry(JSON.parse(await readFile(new URL("./scenarios.json",import.meta.url),"utf8")))
  if(entries.length!==sourceFloors.length||new Set(sourceFloors.map(row=>row.code)).size!==entries.length)throw new Error("source-floor-coverage")
  for(const entry of entries)calibrationFor(entry.code)
  return entries
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
  return {fixtureContentHash:fixtureContentHash(),code:entry.code,seed:entry.seed,steps:entry.status==="reachable" ? entry.steps : [],viewport:entry.viewport,surface:entry.surface,route:entry.route,status:entry.status,assertions:entry.assertions,...(entry.component ? {component:entry.component} : {})}
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
    const expectedComponent=componentTargets[entry.code]
    if(expectedComponent ? !entry.component||entry.component.kind!==expectedComponent.kind||entry.component.target!==expectedComponent.target : entry.component!==undefined)throw new Error("uncalibrated-component")
    if(entry.component&&(entry.component.designBox.left+entry.component.designBox.width>entry.viewport.width||entry.component.designBox.top+entry.component.designBox.height>entry.viewport.height))throw new Error("invalid-component-box")
    if(entry.code==="S33.03"&&(entry.assertions.structure.dialogActions?.primaryKey!=="trash.empty_action"||entry.assertions.structure.dialogActions.cancelKey!=="common.cancel"))throw new Error("missing-dialog-action-structure")
    for(const key of [...entry.assertions.copyKeys,...entry.assertions.entryCopyKeys??[],...[...entry.assertions.controls,...entry.assertions.entryControls??[]].flatMap(control=>"nameKey" in control ? [control.nameKey] : []),...(entry.assertions.probe.kind==="dialog" ? [entry.assertions.probe.titleKey] : [])])resolveCopy(key,entry.assertions.copyValues)
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
export function passesParity(entry:Scenario,score:number|undefined,strict:boolean,componentScore?:number):boolean|null {
  const target=componentTargets[entry.code]?.target
  const componentPassed=target===undefined ? entry.component===undefined : entry.component?.target===target&&componentScore!==undefined&&Number.isFinite(componentScore)&&componentScore<=target
  if(strict&&componentPassed&&score!==undefined&&Number.isFinite(score)&&entry.status==="reachable"&&score<=entry.budget&&sourceVerdict(calibrationFor(entry.code),score)==="uncalibrated")return null
  return componentPassed&&entry.status==="reachable"&&score!==undefined&&Number.isFinite(score)&&score<=entry.budget&&(!strict||sourceVerdict(calibrationFor(entry.code),score)==="pass"&&entry.target===targetFor(entry.code,entry.surface))
}
