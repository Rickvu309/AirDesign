import {mkdir,writeFile} from "node:fs/promises"
import {openSync,closeSync} from "node:fs"
import {spawnSync,execFileSync} from "node:child_process"
import path from "node:path"
import os from "node:os"
const root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),directory=path.join(root,"live"),rows=[]
await mkdir(directory,{recursive:true})
const probes=[
 ["trunk","bench/release/trunk-review.mjs",{}],
 ["examples","bench/release/examples.mjs",{}],
 ["product-review","bench/release/product-review.mjs",{}],
 ["discovery","bench/release/discovery-review.mjs",{}],
 ["site","bench/release/site-review.mjs",{}],
 ["import-export","bench/import-export/browser-check.mjs",{P05_OUTPUT:path.join(root,"import-export")}],
 ["agent-account","bench/agent-account/live.mjs",{P08_EVIDENCE:path.join(root,"local-p08")}],
 ["render-lanes","bench/render/lanes.mjs",{P02_EVIDENCE:path.join(root,"local-p02")}],
 ["apply","bench/render/apply-perf.mjs",{P02_OUTPUT:path.join(root,"local-p02/perf")}],
 ["edit-paint","bench/render/edit-paint.mjs",{P02_OUTPUT:path.join(root,"local-p02/perf")}],
 ["sync","bench/sync/perf-check.mjs",{P04_OUTPUT:path.join(root,"local-p04")}],
 ["mcp","bench/metered-mcp/probe.mjs",{P07_EVIDENCE:path.join(root,"local-p07")}],
 ["libreoffice","bench/release/libreoffice.mjs",{}]
]
for(const [name,script,env]of probes){
 const log=path.join(directory,`${name}.log`),fd=openSync(log,"w"),start=Date.now(),result=spawnSync(process.execPath,[script,...(name==="mcp"?["perf"]:[])],{env:{...process.env,...env,PATH:`${os.homedir()}/tmp/airdesign-autopilot/P01/tools/bin:${process.env.PATH}`},stdio:["ignore",fd,fd],timeout:600000});closeSync(fd)
 const row={head,name,script,status:result.status===0?"pass":"fail",exit:result.status,signal:result.signal,error:result.error?.message,elapsedMs:Date.now()-start,log};rows.push(row);await writeFile(path.join(directory,"index.json"),JSON.stringify({head,rows},null,2));console.log(JSON.stringify(row))
}
if(rows.some(row=>row.status!=="pass"))process.exitCode=1
