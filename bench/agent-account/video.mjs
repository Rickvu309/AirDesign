import assert from "node:assert/strict"
import path from "node:path"
import {scenario,save,head,evidence} from "./fixture.mjs"
const s=await scenario({browserEnabled:true}),session=`p08-video-${process.pid}`
let recording=false
try{
  const owner=await s.fixture.signIn("p08-video@example.com"),id="p08_video"
  await s.deck(owner,id,3);await s.login(session,owner);await s.open(session,`/deck/${id}`,".studio-editor")
  await s.browser(session,"set","viewport","1440","960")
  await s.browser(session,"record","start",path.join(evidence,"review/interaction.mp4"),"--fps","10","--cursor","--contact-sheet");recording=true
  await s.click(session,"Agent");await s.browser(session,"wait","--fn",'Boolean(document.querySelector("#aira-prompt:not(:disabled)"))')
  await s.browser(session,"select","#aira-scope","whole")
  const hold=s.hold(true);await s.browser(session,"fill","#aira-prompt","Build a clear executive story and keep accepted changes if interrupted.");await s.click(session,"Send");await hold.entered.promise
  await s.browser(session,"wait","--fn",'document.querySelector(".aira-run-status")?.textContent.startsWith("Working")');await s.browser(session,"snapshot")
  hold.release.resolve();await s.browser(session,"wait","--fn",'document.querySelector(".aira-run-status")?.textContent.includes("couldn’t finish")');await s.browser(session,"snapshot")
  await s.click(session,"Resume");await s.browser(session,"wait","--fn",'document.querySelector(".aira-run-status")?.textContent.startsWith("Done")')
  await s.browser(session,"click",".editor-changes summary")
  const run=await s.request(owner,`/api/aira?deck=${id}`);assert.equal(run.run.kind,"complete");assert.equal((await s.request(owner,"/api/usage")).used,9)
  await s.browser(session,"record","stop");recording=false
  await save("review/video-receipt.json",{head,verdict:"pass",path:"review/interaction.mp4",script:"bench/agent-account/video.mjs",states:["working","failed after accepted change","resumed","complete","changes by slide"],run:run.run.id,weightedUnits:9})
  console.log(JSON.stringify({head,verdict:"pass",video:"review/interaction.mp4"}))
}finally{if(recording)await s.browser(session,"record","stop").catch(()=>undefined);await save("review/video-trace.json",{head,trace:s.trace});await s.close()}
