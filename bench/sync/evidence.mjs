import { chromium } from "playwright"
import { mkdir, writeFile, readdir, rename } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import os from "node:os"
import { pathToFileURL } from "node:url"
import { localStack, freePort } from "./local-stack.mjs"
import { runLanes } from "./scenarios.mjs"

const output=process.env.P04_OUTPUT ?? `${os.homedir()}/tmp/airdesign-autopilot/P04`
await mkdir(`${output}/review/raw`,{recursive:true})
const stack=await localStack(), port=await freePort()
const browser=await chromium.launch({args:[`--remote-debugging-port=${port}`]})
const session=`p04-evidence-${process.pid}`, cli=[]
function command(args) {
  const result=execFileSync("agent-browser",["--session",session,"--cdp",String(port),...args],{encoding:"utf8",maxBuffer:1024*1024})
  cli.push({args,result});return result
}
try {
  const result=await runLanes({browser,stack,output,contextOptions:{recordVideo:{dir:`${output}/review/raw`,size:{width:1470,height:1000}}},capture:async(name,a,b)=>{
    const folder=/^lane-/.test(name) ? `${output}/${name}` : `${output}/review`
    await mkdir(folder,{recursive:true})
    for(const [label,client] of [["client-a",a],["client-b",b]]) {
      const cdp=await client.context.newCDPSession(client.page)
      const {targetInfo}=await cdp.send("Target.getTargetInfo")
      await cdp.detach()
      command(["tab",targetInfo.targetId])
      command(["screenshot",`${folder}/${name}-${label}.png`])
    }
  }})
  await writeFile(`${output}/review/lanes.json`,JSON.stringify(result,null,2))
  await writeFile(`${output}/review/agent-browser.json`,JSON.stringify({head:result.head,browser:browser.version(),captures:cli},null,2))
  const videos=(await readdir(`${output}/review/raw`)).filter(name=>name.endsWith(".webm"))
  for(let index=0;index<videos.length;index++)await rename(`${output}/review/raw/${videos[index]}`,`${output}/review/client-${index+1}.webm`)
  await writeFile(`${output}/review/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><title>P04 two-client recovery and undo</title><body><h1>P04: two authenticated clients</h1><p>Head ${result.head}. Chronological lanes: convergence, old/new epochs, lost ACK, adoption undo, restart, stale refusal, deleted-slide restore, deleted deck, bounded retries, account isolation.</p><div style="display:flex;gap:8px"><video controls src="client-1.webm" style="width:49%"></video><video controls src="client-2.webm" style="width:49%"></video></div></body></html>`)
  const combined=await browser.newContext({viewport:{width:1470,height:650},recordVideo:{dir:`${output}/review/raw`,size:{width:1470,height:650}}})
  const player=await combined.newPage()
  await player.goto(pathToFileURL(`${output}/review/index.html`).href)
  await player.locator("video").evaluateAll(videos=>Promise.all(videos.map(video=>new Promise(resolve=>{if(video.readyState>=2)resolve();else video.addEventListener("loadeddata",resolve,{once:true})}))))
  await player.locator("video").evaluateAll(videos=>Promise.all(videos.map(video=>{video.muted=true;video.playbackRate=1.5;return video.play()})))
  await player.waitForFunction(()=>[...document.querySelectorAll("video")].every(video=>video.ended),null,{timeout:180000})
  const combinedPath=await player.video().path()
  await combined.close()
  await rename(combinedPath,`${output}/review/two-clients.webm`)
  await writeFile(`${output}/review/video.json`,JSON.stringify({head:result.head,method:"Side-by-side browser playback of the two continuous authenticated-client recordings, at 1.5x speed",sources:["client-1.webm","client-2.webm"],output:"two-clients.webm"},null,2))
  process.stdout.write(JSON.stringify({head:result.head,lanes:result.receipts.map(({lane,verdict})=>({lane,verdict})),screenshots:cli.filter(entry=>entry.args[0]==="screenshot").length,videos:videos.length})+"\n")
} finally {
  try{command(["close"])}catch{}
  await browser.close();await stack.close()
}
