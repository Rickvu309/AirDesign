import {it,expect,vi} from "vitest"
import {spawn} from "node:child_process"
import {once} from "node:events"
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {RemoteJournal} from "../src/remote-journal.ts"
import {drainRemoteQueue} from "../src/remote-queue.ts"
it("kills a crashed remote worker group and erases its persisted upload mapping after restart",async()=>{
 const root=await mkdtemp(path.join(os.homedir(),"tmp/remote-crash-")),program=path.join(root,"job.mjs")
 await writeFile(program,`import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});writeFileSync('ready',String(child.pid));setInterval(()=>{},1000)`)
 const supervisor=spawn(process.execPath,["--input-type=module","-e",`
 import {OperationStore} from './packages/operations/src/index.ts';import {deliver} from './apps/worker/src/isolation.ts';import {RemoteJournal} from './apps/worker/src/remote-journal.ts';import {watch,readFileSync} from 'node:fs';
 const root=${JSON.stringify(root)},journal=new RemoteJournal(root),database=root+'/local.sqlite',store=new OperationStore(database),job=store.submit({personId:'deleted-owner'},'request',Buffer.from('private upload'));
 const lease='00000000-0000-4000-8000-000000000001';journal.save({id:'00000000-0000-4000-8000-000000000002',lease,queue:'import',database,directory:null,unit:null,pid:null,identity:null,mode:'container'});
 await deliver(store,job.id,root,${JSON.stringify(program)},process=>{journal.started(lease,process);if(!process.pid)return;const watcher=watch(process.directory,(_,file)=>{if(file==='ready'){watcher.close();globalThis.process.stdout.write(readFileSync(process.directory+'/ready','utf8')+'\\n')}})});
 `],{cwd:process.cwd(),env:{...process.env,AIRDESIGN_ISOLATION:"container"},stdio:["ignore","pipe","pipe"]})
 let descendant=0
 try{
  const [data]=await once(supervisor.stdout,"data",{signal:AbortSignal.timeout(10000)})
  descendant=Number.parseInt(data.toString(),10)
  expect(descendant).toBeGreaterThan(0)
  supervisor.kill("SIGKILL");await once(supervisor,"exit")
  let journal=new RemoteJournal(root)
  try{
   const entries=journal.entries();expect(entries).toHaveLength(1)
   const entry=entries[0];if(!entry?.directory||!entry.database)throw new Error("missing-scratch")
   expect(await readFile(path.join(entry.directory,"input.pptx"),"utf8")).toBe("private upload")
   const database=entry.database
   expect(entry.id).toBe("00000000-0000-4000-8000-000000000002")
   journal.close()
   const commands:unknown[]=[]
   const transport=vi.spyOn(globalThis,"fetch").mockImplementation(async(_,input)=>{
    const command=JSON.parse(String(input?.body))
    commands.push(command)
    await expect(readFile(path.join(entry.directory ?? "","input.pptx"))).rejects.toThrow()
    await expect(readFile(database)).rejects.toThrow()
    return Response.json(command.kind==="claim"?null:{ok:true})
   })
   try{await drainRemoteQueue("https://worker.test","test-secret",root)}finally{transport.mockRestore();journal=new RemoteJournal(root)}
   expect(commands).toEqual([
    {kind:"fail",queue:"import",id:entry.id,lease:entry.lease,reason:"worker-restarted"},
    {kind:"cleaned",queue:"import",id:entry.id,lease:entry.lease},
    {kind:"claim",queue:"image"},
    {kind:"claim",queue:"import"},
   ])
   await expect(readFile(path.join(entry.directory,"input.pptx"))).rejects.toThrow()
   await expect(readFile(database)).rejects.toThrow()
   const stat=await readFile(`/proc/${descendant}/stat`,"utf8").catch(()=>"")
   expect(stat===""||stat.split(") ")[1]?.startsWith("Z")).toBe(true)
   expect(journal.entries()).toEqual([])
  }finally{journal.close()}
 }finally{
  supervisor.kill("SIGKILL")
  if(descendant)try{process.kill(descendant,"SIGKILL")}catch{}
  await rm(root,{recursive:true,force:true});vi.unstubAllEnvs()
 }
},15000)

it("rejects a supervisor that died before the container entry started",async()=>{
 const root=await mkdtemp(path.join(os.homedir(),"tmp/remote-orphan-")),program=path.join(root,"job.mjs"),marker=path.join(root,"started")
 await writeFile(program,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'started')`)
 const child=spawn(process.execPath,[path.resolve(import.meta.dirname,"../src/container-entry.ts"),program,String(process.pid+1000000)],{cwd:root,detached:true,stdio:["pipe","ignore","ignore"]})
 try{
  child.stdin?.end("start")
  const [code,signal]=await once(child,"exit",{signal:AbortSignal.timeout(5000)})
  expect(code).toBeNull();expect(signal).toBe("SIGKILL")
  await expect(readFile(marker)).rejects.toThrow()
 }finally{child.kill("SIGKILL");await rm(root,{recursive:true,force:true})}
})
