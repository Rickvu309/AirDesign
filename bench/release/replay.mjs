import assert from "node:assert/strict"
import {readFile,mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {scenario,head} from "../agent-account/fixture.mjs"
import {fontDeck,assertFontChange} from "../agent-account/font-contract.mjs"
import {summarize,replayLabel} from "../quality/protocol.ts"
const root=process.env.P09_EVIDENCE ?? path.join(os.homedir(),"tmp/airdesign-autopilot/P09")
const release=JSON.parse(await readFile("bench/quality/release-set.json","utf8"))
const s=await scenario(), rows=[], outputs=[]
try {
 const owner=await s.fixture.signIn("p09-replay@example.com")
 for(const task of release.tasks)for(let sample=0;sample<3;sample++){
  const id=`${task.id}-${sample}`,request=`${task.family}: ${task.source.periods[4]} revenue ${task.source.revenue[4]} ${task.source.units}`
  const before=fontDeck(id,1)
  await s.request(owner,"/api/decks",before,201)
  const run=await s.run(owner,id,request,["s0e0"])
  assert.equal(run.kind,"complete")
  const saved=await s.request(owner,`/api/decks/${id}`)
  assertFontChange(before,saved.deck,["s0e0"])
  outputs.push({task:task.id,sample,run:run.id,deck:saved,label:replayLabel})
  rows.push({task:task.id,sample,hard:false,content:false,editable:false,forward:"unresolved",reverse:"unresolved"})
 }
 const result={head,label:replayLabel,adapter:"localAdapter",qualityStatus:"blocked-X03-X04",replayCompleted:outputs.length,summary:summarize(release.tasks,rows)}
 await mkdir(path.join(root,"quality"),{recursive:true})
 await writeFile(path.join(root,"quality/replay.json"),JSON.stringify(result,null,2))
 await writeFile(path.join(root,"quality/replay-outputs.json"),JSON.stringify(outputs,null,2))
 assert.equal(result.replayCompleted,144)
 console.log(JSON.stringify({head,label:replayLabel,replayCompleted:result.replayCompleted,qualityStatus:result.qualityStatus,thresholdsMet:result.summary.thresholdsMet}))
}finally{await s.close()}
