import assert from "node:assert/strict"
import {mkdir,writeFile,copyFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {scenario,head} from "../agent-account/fixture.mjs"
import {fixtureDeck,fixtureElement} from "../../packages/deck/src/fixture.ts"
const root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),s=await scenario({browserEnabled:true}),session=`p09-product-${process.pid}`
await mkdir(path.join(root,"review"),{recursive:true})
const title=fixtureElement(0),shape=fixtureElement(1),text=(id,value,x,y,width,height,size=24)=>({...title,id,box:{x,y,width,height},runs:[{text:value,bold:size>=30,font:"Geist",size,color:"#172333"}]})
try{
 const owner=await s.fixture.signIn("release-capture@example.com"),deck={...fixtureDeck(1,3),id:"release_capture"}
 deck.slides[0].elements=[text("s0e0","Revenue is growing. Focus on capacity.",48,40,850,70,36),text("revenue_label","Quarterly revenue · USD millions",48,134,650,40,22),...([41,48,53,62].flatMap((value,i)=>[{...shape,id:`bar${i}`,geometry:"rectangle",fill:"#3e6fbe",box:{x:70+i*165,y:420-value*3.1,width:90,height:value*3.1}},text(`q${i}`,`Q${i+1} · ${value}`,65+i*165,438,150,36,20)])),text("source","Source: synthetic release example. No business data.",48,497,850,24,16)]
 await s.request(owner,"/api/decks",deck,201);await s.login(session,owner);await s.browser(session,"set","viewport","1440","1000");await s.open(session,"/deck/release_capture",".studio-editor")
 await s.browser(session,"wait","--fn",'document.querySelector(".studio-editor")?.textContent.includes("Saved") && document.querySelector(".studio-editor")?.textContent.includes("Revenue is growing. Focus on capacity.")')
 await s.click(session,"Single slide view");await s.browser(session,"wait","--fn",'document.querySelector(".studio-editor")?.getAttribute("data-view")==="single"');await s.browser(session,"screenshot",path.join(root,"review/studio-before.png"));await s.browser(session,"record","start",path.join(root,"review/interaction.webm"));await s.click(session,"Agent")
 const run=await s.run(owner,deck.id,"Revenue grew 51%. Expand capacity deliberately.",["s0e0"]);assert.equal(run.kind,"complete")
 await s.browser(session,"wait","--fn",'document.querySelector(".aira-run-status")?.textContent.startsWith("Done")')
 await s.browser(session,"screenshot",path.join(root,"review/studio-after.png"));if(process.argv.includes("--publish"))await copyFile(path.join(root,"review/studio-after.png"),"apps/site/public/studio-capture.png")
 const hold=s.hold(true),stream=await s.stream(owner,deck.id);await s.request(owner,`/api/aira?deck=${deck.id}`,{action:"send",text:"Keep the accepted changes if interrupted",selection:["s0e0"]},202);await hold.entered.promise;hold.release.resolve();await s.until(stream,value=>value.run?.kind==="failed")
 await s.browser(session,"wait","--fn",'document.querySelector(".aira-run-status")?.textContent.includes("couldn’t finish")');await s.browser(session,"screenshot",path.join(root,"review/studio-failure.png"));await s.browser(session,"record","stop")
 await s.browser(session,"set","viewport","320","960");await s.browser(session,"screenshot",path.join(root,"review/studio-mobile.png"))
 await writeFile(path.join(root,"review/product.json"),JSON.stringify({head,status:"pass",capture:"actual built Studio; synthetic saved deck; deterministic local adapter",deck:deck.id,before:"studio-before.png",after:"studio-after.png",failure:"studio-failure.png",video:"interaction.webm",remoteModel:"blocked-X03",trace:s.trace},null,2));console.log(JSON.stringify({head,capture:"pass",video:"interaction.webm"}))
}finally{await s.close()}
