import assert from "node:assert/strict"
import {readFile,writeFile} from "node:fs/promises"
import {createHash} from "node:crypto"
import {summarize} from "../quality/protocol.ts"
import {calibrate} from "../quality/calibration.ts"
import {toolVerdict} from "../quality/tool-verdict.ts"
const [kind,input,output]=process.argv.slice(2)
assert.ok(["quality","calibration","tools"].includes(kind)&&input&&output,"Usage: node bench/release/assess-external.mjs quality|calibration|tools input.json output.json")
const source=JSON.parse(await readFile(input,"utf8"))
assert.ok(source.authorization&&source.operator&&source.environment&&source.head,"Actual operator authorization, environment and head required")
let result
if(kind==="calibration")result=calibrate(source.rows)
if(kind==="tools"){
 assert.ok(source.models.every(model=>model.version&&model.provider&&model.sdk)&&source.actualSdkRun&&source.baselineHead,"Pin model/provider/SDK and baseline; include actual SDK run")
 const tasks=JSON.parse(await readFile("bench/quality/tool-tasks.json","utf8"));result=toolVerdict(tasks.tasks,source.models.map(model=>model.version),source.rows)
}
if(kind==="quality"){
 const bytes=await readFile("bench/quality/release-set.json"),release=JSON.parse(bytes)
 assert.equal(source.releaseSetSha256,createHash("sha256").update(bytes).digest("hex"))
 assert.equal(source.baselines.length,48);assert.equal(new Set(source.baselines.map(row=>row.task)).size,48)
 for(const baseline of source.baselines)assert.ok(release.tasks.some(task=>task.id===baseline.task)&&/^[a-f0-9]{64}$/.test(baseline.sha256)&&baseline.humanVetted&&baseline.frozenBeforeGeneration)
 assert.equal(source.calibration.judgeEligible,true,"Calibrated human evidence required before judging")
 assert.ok(source.rows.every(row=>["win","tie","loss","unresolved"].includes(row.forward)&&["win","tie","loss","unresolved"].includes(row.reverse)&&[row.hard,row.content,row.editable].every(value=>typeof value==="boolean")))
 assert.ok(source.previousFrozenBeforeGeneration && source.previousHead!==source.head && source.previousHead && /^[a-f0-9]{64}$/.test(source.previousResultsSha256),"Pin frozen previous release results")
 const previousBytes=await readFile(source.previousResultsPath)
 assert.equal(createHash("sha256").update(previousBytes).digest("hex"),source.previousResultsSha256)
 const previous=JSON.parse(previousBytes)
 assert.equal(previous.head,source.previousHead)
 result=summarize(release.tasks,source.rows,20261106,previous.cases)
}
await writeFile(output,JSON.stringify({head:source.head,kind,result,acceptance:"numeric assessment only; operator must inspect raw evidence and close external gate"},null,2))
console.log(JSON.stringify({kind,output,accepted:result.thresholdsMet??result.judgeEligible??result.pass}))
