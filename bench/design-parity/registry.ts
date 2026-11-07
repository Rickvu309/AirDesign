import {readFile} from "node:fs/promises"
import {execFileSync} from "node:child_process"
import {z} from "zod"
const namedStep=z.object({kind:z.enum(["click","keyboard-activate","dialog-click","hover"]),name:z.string().min(1)})
const fieldStep=z.object({kind:z.enum(["fill","select"]),label:z.string().min(1),value:z.string()})
const stepSchema=z.union([namedStep,fieldStep,z.object({kind:z.literal("wait-text"),text:z.string().min(1)}),z.object({kind:z.literal("selector-click"),selector:z.string().min(1)}),z.object({kind:z.literal("import"),outcome:z.enum(["queued","failed"])}),z.object({kind:z.literal("agent"),outcome:z.enum(["working","complete","failed","long-message","remote","limited"])}),z.object({kind:z.enum(["offline","pay","expire-payment","export-failed"])})])
const common={code:z.string().regex(/^S[0-9]{2}\.[0-9]{2}$/),design:z.string(),viewport:z.object({width:z.number().int().positive(),height:z.number().int().positive()}),seed:z.enum(["signed-out","empty-account","recents","trash-with-items","deck-open","usage-active","usage-active-connected","deck-limited","deck-limited-with-credits","oauth-Claude","oauth-Codex"]),budget:z.number().min(0).max(1),budgetRaisedBecause:z.string().optional()}
const surface=z.discriminatedUnion("surface",[z.object({surface:z.literal("site"),route:z.string().startsWith("/")}),z.object({surface:z.literal("studio"),route:z.string().startsWith("/")})])
const scenarioSchema=z.intersection(surface,z.discriminatedUnion("status",[z.object({...common,status:z.literal("reachable"),steps:z.array(stepSchema)}),z.object({...common,status:z.literal("unreachable"),reason:z.string().min(1)})]))
export type Step=z.infer<typeof stepSchema>
export type Scenario=z.infer<typeof scenarioSchema>
export function parseRegistry(value:unknown):Scenario[]{return z.array(scenarioSchema).parse(value)}
export async function readRegistry():Promise<Scenario[]> {
  return parseRegistry(JSON.parse(await readFile(new URL("./scenarios.json",import.meta.url),"utf8")))
}
export async function readBudgetBaseline():Promise<Record<string,number>> {
  const baseline:Record<string,number>=JSON.parse(await readFile(new URL("./budget-baseline.json",import.meta.url),"utf8"))
  let source:string
  try{source=execFileSync("git",["show","HEAD:bench/design-parity/scenarios.json"],{encoding:"utf8",stdio:["ignore","pipe","ignore"]})}catch{return baseline}
  for(const entry of parseRegistry(JSON.parse(source)))baseline[entry.code]=Math.min(baseline[entry.code] ?? 1,entry.budget)
  return baseline
}
export function validateRegistry(entries:Scenario[],images:string[],baseline:Record<string,number>):void {
  if(new Set(entries.map(entry=>entry.code)).size!==entries.length)throw new Error("duplicate-screen")
  if(entries.length!==images.length||images.some(image=>!entries.some(entry=>entry.design.endsWith("/"+image))))throw new Error("screen-coverage")
  for(const entry of entries){
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
