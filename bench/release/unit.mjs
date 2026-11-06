import {mkdir,writeFile} from "node:fs/promises"
import {openSync,closeSync} from "node:fs"
import {spawnSync,execFileSync} from "node:child_process"
import os from "node:os"
import path from "node:path"
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),directory=path.join(root,"unit"),rows=[]
await mkdir(directory,{recursive:true})
for(const command of ["test","typecheck","lint",...Array.from({length:9},(_,i)=>`verify:pr-${String(i+1).padStart(2,"0")}`)]){
 const file=path.join(directory,`${command.replaceAll(":","-")}.log`),fd=openSync(file,"w"),start=Date.now(),result=spawnSync("npm",["run",command],{stdio:["ignore",fd,fd],timeout:600000});closeSync(fd);const row={head,command:`npm run ${command}`,status:result.status===0?"pass":"fail",exit:result.status,signal:result.signal,error:result.error?.message,elapsedMs:Date.now()-start,log:file};rows.push(row);await writeFile(path.join(directory,"index.json"),JSON.stringify({head,rows},null,2));console.log(JSON.stringify(row))
}
if(rows.some(row=>row.status!=="pass"))process.exitCode=1
