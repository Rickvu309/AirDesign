import { exportLimits, type ExportFailure } from "../../../../packages/operations/src/export-failure.ts"
import {residentBytes,scopeOomKilled} from "./resource-monitor.ts"
import {RemoteJournal} from "../remote-journal.ts"
import {isolationMode, spawnContainerJob, killContainerJob} from "../container-process.ts"
import { spawn } from "node:child_process"
import { mkdir,writeFile,readFile,rm,rmdir } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import type { exportStore } from "../../../server/src/decks/export-store.ts"

export async function recoverExports(store:Pick<ReturnType<typeof exportStore>,"fail">,root:string) {
  const journal=new RemoteJournal(root)
  try{
    for(const entry of journal.entries().filter(entry=>entry.queue==="export")){
      await journal.clean(entry)
      await store.fail(entry.id,entry.lease,"worker-restarted")
      journal.forget(entry.lease)
    }
  }finally{journal.close()}
}

export async function deliverExport(store:ReturnType<typeof exportStore>,root:string) {
  await recoverExports(store,root)
  const journal=new RemoteJournal(root)
  const job=await store.claim();if(!job){journal.close();return null}
  const directory=path.join(root,job.id,job.lease),unit=`airdesign-export-${job.id}-${job.lease}.scope`
  let cleanup:(()=>void)|undefined
  let timer:ReturnType<typeof setTimeout>|undefined,cancellation:ReturnType<typeof setInterval>|undefined,resources:ReturnType<typeof setInterval>|undefined,killed:Promise<void>|undefined
  try {
    journal.save({id:job.id,lease:job.lease,queue:"export",database:null,directory,unit,pid:null,identity:null,mode:isolationMode()})
    await mkdir(directory,{recursive:true,mode:0o700});await writeFile(path.join(directory,"input.json"),JSON.stringify(job),{mode:0o600})
    const repo=path.resolve(import.meta.dirname,"../../../.."),cache=process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(os.homedir(),".cache/ms-playwright")
    const child=isolationMode() === "container" ? spawnContainerJob(directory,path.join(import.meta.dirname,"entry.ts"),pid=>journal.started(job.lease,{directory,unit,pid})) : spawn("systemd-run",["--user","--scope","--quiet",`--unit=${unit}`,"-p",`MemoryMax=${exportLimits.memoryBytes}`,"-p","MemorySwapMax=0","-p","CPUQuota=200%","prlimit",`--cpu=${exportLimits.cpuSeconds}:${exportLimits.cpuSeconds+1}`,"--fsize=524288000","--nofile=256","--","bwrap","--unshare-all","--die-with-parent","--new-session","--ro-bind","/usr","/usr","--ro-bind","/lib","/lib","--ro-bind-try","/lib64","/lib64","--ro-bind","/etc/fonts","/etc/fonts","--ro-bind",repo,repo,"--ro-bind",cache,cache,"--bind",directory,"/job","--proc","/proc","--dev","/dev","--tmpfs","/tmp","--chdir","/job","--clearenv","--setenv","PATH","/usr/bin","--setenv","HOME",os.homedir(),"--setenv","PLAYWRIGHT_BROWSERS_PATH",cache,"/usr/bin/node","--max-old-space-size=384",path.join(import.meta.dirname,"entry.ts")],{stdio:["ignore","ignore","pipe"]})
    let diagnostic="",failure:ExportFailure|null=null,monitoring=false,exited=false
    if(isolationMode()==="container")resources=setInterval(()=>{const pid=child.pid;if(monitoring||!pid||exited)return;monitoring=true;void (async()=>{if(isolationMode()==="container"){if(await residentBytes(child)>exportLimits.memoryBytes&&!exited){failure??={kind:"limit",limit:"memory",signal:"SIGKILL"};kill()}}})().catch(()=>{if(!exited){failure??={kind:"application",code:"export-resource-monitor-failed"};kill()}}).finally(()=>{monitoring=false})},100)
    child.stderr?.on("data",(value:Buffer)=>{diagnostic=(diagnostic+value.toString()).slice(-2000)})
    function kill(){if(isolationMode() === "container"){killContainerJob(child);return}killed??=new Promise(resolve=>{const killer=spawn("systemctl",["--user","kill","--signal=SIGKILL",unit],{stdio:"ignore"});const finish=()=>{if(!exited)child.kill("SIGKILL");resolve()};killer.once("exit",finish);killer.once("error",finish)})}
    cleanup=kill
    timer=setTimeout(()=>{failure??={kind:"limit",limit:"wall-clock",signal:"SIGKILL"};kill()},Math.max(1,job.deadline-Date.now()))
    let checking=false
    cancellation=setInterval(()=>{if(checking)return;checking=true;void store.active(job.id,job.lease).then(active=>{if(!active&&!exited){failure??={kind:"application",code:"export-cancelled"};kill()}}).catch(()=>{if(!exited){failure??={kind:"application",code:"export-lease-check-failed"};kill()}}).finally(()=>{checking=false})},50)
    const {code,signal}=await new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{child.once("error",reject);child.once("exit",(code,signal)=>resolve({code,signal}))})
    exited=true;kill();await killed;clearTimeout(timer);clearInterval(resources);clearInterval(cancellation)
    if(code!==0){
      const limitSignal=signal ?? (code===128+os.constants.signals.SIGXCPU ? "SIGXCPU" : code===128+os.constants.signals.SIGXFSZ ? "SIGXFSZ" : null)
      failure??=isolationMode()==="systemd" && await scopeOomKilled(unit) ? {kind:"limit",limit:"memory",signal} : limitSignal==="SIGXCPU" ? {kind:"limit",limit:"cpu",signal:limitSignal} : limitSignal==="SIGXFSZ" ? {kind:"limit",limit:"file-size",signal:limitSignal} : signal ? {kind:"signal",signal} : {kind:"exit",code:code ?? 1,diagnostic:diagnostic.slice(-200)}
      const bytes=await readFile(path.join(directory,"failure.json")).catch(()=>null)
      if(bytes && bytes.length<=1024 && failure.kind==="exit"){
        const value:unknown=JSON.parse(bytes.toString())
        if(value && typeof value==="object" && "code" in value && typeof value.code==="string")failure={kind:"application",code:value.code}
      }
      await store.fail(job.id,job.lease,failure)
      return {id:job.id,committed:false}
    }
    const result=await readFile(path.join(directory,"result.bin")),bytes=await readFile(path.join(directory,"report.json"))
    if(bytes.length>8*1024*1024)throw new Error("export-report-limit")
    const report:unknown=JSON.parse(bytes.toString());if(!report||typeof report!=="object"||Array.isArray(report))throw new Error("invalid-export-report")
    return {id:job.id,committed:await store.complete(job.id,job.lease,result,Object.fromEntries(Object.entries(report)))}
  }catch(error){await store.fail(job.id,job.lease,{kind:"application",code:error instanceof Error ? error.message : "export-failed"});return {id:job.id,committed:false}}
  finally{if(timer)clearTimeout(timer);if(cancellation)clearInterval(cancellation);if(resources)clearInterval(resources);cleanup?.();await killed;await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await rmdir(path.join(root,job.id)).catch(error=>{if(error.code!=="ENOTEMPTY" && error.code!=="ENOENT")throw error});journal.forget(job.lease);journal.close()}
}
