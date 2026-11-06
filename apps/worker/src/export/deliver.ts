import {isolationMode, spawnContainerJob, killContainerJob} from "../container-process.ts"
import { spawn } from "node:child_process"
import { mkdir,writeFile,readFile,rm,rmdir } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import type { exportStore } from "../../../server/src/decks/export-store.ts"

export async function deliverExport(store:ReturnType<typeof exportStore>,root:string) {
  const job=await store.claim();if(!job)return null
  const directory=path.join(root,job.id,job.lease),unit=`airdesign-export-${job.id}-${job.lease}.scope`
  let timer:ReturnType<typeof setTimeout>|undefined,cancellation:ReturnType<typeof setInterval>|undefined,killed:Promise<void>|undefined
  try {
    await mkdir(directory,{recursive:true,mode:0o700});await writeFile(path.join(directory,"input.json"),JSON.stringify(job),{mode:0o600})
    const repo=path.resolve(import.meta.dirname,"../../../.."),cache=process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(os.homedir(),".cache/ms-playwright")
    const child=isolationMode() === "container" ? spawnContainerJob(directory,path.join(import.meta.dirname,"entry.ts")) : spawn("systemd-run",["--user","--scope","--quiet",`--unit=${unit}`,"-p","MemoryMax=805306368","-p","MemorySwapMax=0","-p","CPUQuota=200%","prlimit","--cpu=30","--fsize=524288000","--nofile=256","--","bwrap","--unshare-all","--die-with-parent","--new-session","--ro-bind","/usr","/usr","--ro-bind","/lib","/lib","--ro-bind","/etc/fonts","/etc/fonts","--ro-bind",repo,repo,"--ro-bind",cache,cache,"--bind",directory,"/job","--proc","/proc","--dev","/dev","--tmpfs","/tmp","--chdir","/job","--clearenv","--setenv","PATH","/usr/bin","--setenv","HOME",os.homedir(),"--setenv","PLAYWRIGHT_BROWSERS_PATH",cache,"/usr/bin/node","--max-old-space-size=384",path.join(import.meta.dirname,"entry.ts")],{stdio:["ignore","ignore","pipe"]})
    let diagnostic=""
    child.stderr?.on("data",(value:Buffer)=>{diagnostic=(diagnostic+value.toString()).slice(-2000)})
    function kill(){if(isolationMode() === "container"){killContainerJob(child);return}killed??=new Promise(resolve=>{const killer=spawn("systemctl",["--user","kill","--signal=SIGKILL",unit],{stdio:"ignore"});const finish=()=>{child.kill("SIGKILL");resolve()};killer.once("exit",finish);killer.once("error",finish)})}
    timer=setTimeout(kill,Math.max(1,job.deadline-Date.now()))
    let checking=false
    cancellation=setInterval(()=>{if(checking)return;checking=true;void store.active(job.id,job.lease).then(active=>{if(!active)kill()}).catch(kill).finally(()=>{checking=false})},50)
    const code=await new Promise<number|null>((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve)})
    if(code!==0){const bytes=await readFile(path.join(directory,"failure.json")).catch(()=>null);let reason=`isolated-export-failed:${code}:${diagnostic.slice(-200)}`;if(bytes && bytes.length<=1024){const value:unknown=JSON.parse(bytes.toString());if(value && typeof value==="object" && "code" in value && typeof value.code==="string")reason=value.code}throw new Error(reason)}
    const result=await readFile(path.join(directory,"result.bin")),bytes=await readFile(path.join(directory,"report.json"))
    if(bytes.length>8*1024*1024)throw new Error("export-report-limit")
    const report:unknown=JSON.parse(bytes.toString());if(!report||typeof report!=="object"||Array.isArray(report))throw new Error("invalid-export-report")
    return {id:job.id,committed:await store.complete(job.id,job.lease,result,Object.fromEntries(Object.entries(report)))}
  }catch(error){await store.fail(job.id,job.lease,error instanceof Error ? error.message : "export-failed");return {id:job.id,committed:false}}
  finally{if(timer)clearTimeout(timer);if(cancellation)clearInterval(cancellation);await killed;await rm(directory,{recursive:true,force:true});await rmdir(path.join(root,job.id)).catch(error=>{if(error.code!=="ENOTEMPTY" && error.code!=="ENOENT")throw error})}
}
