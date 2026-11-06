import assert from "node:assert/strict"
import {readFile,mkdir,writeFile} from "node:fs/promises"
import {execFileSync} from "node:child_process"
import path from "node:path"
import os from "node:os"
import {scenario,toolValue} from "../agent-account/fixture.mjs"
import {replayLabel} from "../quality/protocol.ts"
const tasks=JSON.parse(await readFile("bench/quality/tool-tasks.json","utf8")),s=await scenario(),rows=[]
try{
 const owner=await s.fixture.signIn("p09-tools@example.com"),foreign=await s.fixture.signIn("p09-foreign@example.com"),authorized=await s.fixture.authorize(owner.cookie),other=await s.fixture.authorize(foreign.cookie)
 for(const task of tasks.tasks)for(let trial=0;trial<3;trial++){
  const id=`tool-${task.id}-${trial}`;await s.deck(owner,id,task.slides)
  const before=await s.fixture.history.read(owner,id),slide=before.deck.slides[0],change={kind:"set",target:slide.id,value:{...slide,notes:`accepted ${id}`}}
  const start=performance.now()
  const call=(name,args,client=authorized.client)=>client.callTool({name,arguments:args})
  let response
  if(task.kind==="read"){
   const ids=[];let cursor
   do{response=await call("get_deck",{deckId:id,...cursor?{cursor}:{}});assert.notEqual(response.isError,true);const value=toolValue(response);ids.push(...value.items.map(item=>item.id));cursor=value.nextCursor}while(cursor)
   assert.deepEqual(ids,before.deck.slides.map(item=>item.id))
  }else{
   if(task.kind==="stale")assert.notEqual((await call("apply_changes",{deckId:id,base:0,requestId:`first-${id}`,changes:[change]})).isError,true)
   response=await call("apply_changes",{deckId:id,base:0,requestId:`trial-${id}`,changes:task.kind==="atomicity"?[change,{kind:"remove",target:"absent"}]:[change]},task.kind==="authorization"?other.client:authorized.client)
   if(task.kind==="edit")assert.notEqual(response.isError,true);else assert.equal(response.isError,true)
   const after=await s.fixture.history.read(owner,id)
   if(task.kind==="authorization"||task.kind==="atomicity")assert.deepEqual(after,before)
   else assert.equal(after.seq,1)
  }
  rows.push({task:task.id,trial,pass:true,ms:performance.now()-start,response,label:replayLabel})
 }
 const root=path.join(process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),"tool-eval");await mkdir(root,{recursive:true});await writeFile(path.join(root,"replay.json"),JSON.stringify({head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),label:replayLabel,modelAcceptance:"blocked-X03",rows},null,2));console.log(JSON.stringify({label:replayLabel,tasks:tasks.tasks.length,trials:rows.length,passed:rows.filter(row=>row.pass).length}))
}finally{await s.close()}
