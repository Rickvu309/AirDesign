import {it,expect} from "vitest"
import {spawn} from "node:child_process"
import {once} from "node:events"
import {createInterface} from "node:readline"
import {mkdtemp,mkdir,cp,symlink,readFile,writeFile,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {fixtureDeck} from "../../../packages/deck/src/fixture.ts"
import {RemoteJournal} from "../src/remote-journal.ts"

it("erases a PDF lease and its descendants after SIGKILL during page.pdf and restart",async()=>{
 const root=await mkdtemp(path.join(os.homedir(),"tmp/export-crash-")),shadow=path.join(root,"shadow"),scratch=path.join(root,"jobs")
 await mkdir(path.join(shadow,"apps/worker"),{recursive:true});await mkdir(scratch)
 await cp("apps/worker/src",path.join(shadow,"apps/worker/src"),{recursive:true})
 await symlink(path.resolve("apps/worker/dist"),path.join(shadow,"apps/worker/dist"))
 await symlink(path.resolve("packages"),path.join(shadow,"packages"))
 await symlink(path.resolve("node_modules"),path.join(shadow,"node_modules"))
 await writeFile(path.join(shadow,"package.json"),JSON.stringify({type:"module"}))
 const entry=path.join(shadow,"apps/worker/src/export/entry.ts"),source=await readFile(entry,"utf8")
 await writeFile(entry,source.replace('output=await page.pdf(', 'const rendering=page.pdf(').replace('margin:{top:0,right:0,bottom:0,left:0}})','margin:{top:0,right:0,bottom:0,left:0}});await writeFile(jobPath("pdf-active"),"rendering");output=await rendering'))
 const job={id:"00000000-0000-4000-8000-000000000002",lease:"00000000-0000-4000-8000-000000000001",deadline:Date.now()+60000,options:{format:"pdf",slides:[],allowIssues:true},snapshot:{deck:fixtureDeck(20,50),seq:0}}
 await writeFile(path.join(root,"job.json"),JSON.stringify(job))
 const program=`import {deliverExport} from ${JSON.stringify(path.join(shadow,"apps/worker/src/export/deliver.ts"))};import {watch,readFileSync,existsSync} from 'node:fs';
 const root=${JSON.stringify(scratch)},job=JSON.parse(readFileSync(${JSON.stringify(path.join(root,"job.json"))},'utf8'));
 const recovery=process.argv[1]==='recover';
 let announced=false;const watcher=watch(root,{recursive:true},(_,file)=>{if(!announced&&!recovery&&file?.endsWith('pdf-active')&&existsSync(root+'/'+job.id+'/'+job.lease+'/pdf-active')){announced=true;watcher.close();process.stdout.write('pdf-active\\n')}});
 await deliverExport({claim:async()=>recovery?null:job,active:async()=>true,complete:async()=>true,fail:async(_id,_lease,failure)=>{if(!recovery)process.stderr.write(JSON.stringify(failure));if(recovery&&existsSync(root+'/'+job.id+'/'+job.lease))throw new Error('ack-before-cleanup')}},root);watcher.close();if(recovery)process.stdout.write('recovered\\n');`
 const env={...process.env,AIRDESIGN_ISOLATION:"container",PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(os.homedir(),".cache/ms-playwright")}
 const supervisor=spawn(process.execPath,["--input-type=module","-e",program],{env,stdio:["ignore","pipe","pipe"]})
 const supervisorLines=createInterface({input:supervisor.stdout})
 let stderr="";supervisor.stderr.on("data",chunk=>{stderr=(stderr+chunk).slice(-3000)})
 let pid:number|null=null
 try{
  const [marker]=await Promise.race([once(supervisorLines,"line",{signal:AbortSignal.timeout(25000)}),once(supervisor,"exit").then(()=>{throw new Error("export-exited-before-pdf"+stderr)})]).catch(error=>{throw new Error(String(error)+stderr)})
  expect(marker.toString().trim()).toBe("pdf-active")
  const exit=once(supervisor,"exit");supervisor.kill("SIGKILL");await exit
  const journal=new RemoteJournal(scratch)
  const entries=journal.entries();journal.close()
  expect(entries).toHaveLength(1)
  const ownership=entries[0];if(!ownership?.directory||!ownership.pid)throw new Error("missing-export-ownership")
  pid=ownership.pid
  expect(await readFile(path.join(ownership.directory,"input.json"),"utf8")).toContain(job.id)
  const restarted=spawn(process.execPath,["--input-type=module","-e",program,"recover"],{env,stdio:["ignore","pipe","pipe"]})
  const restartedLines=createInterface({input:restarted.stdout})
  const restartedExit=once(restarted,"exit")
  const [recovered]=await once(restartedLines,"line",{signal:AbortSignal.timeout(10000)})
  expect(recovered.toString().trim()).toBe("recovered")
  expect((await restartedExit)[0]).toBe(0)
  await expect(readFile(path.join(ownership.directory,"input.json"))).rejects.toThrow()
  const after=new RemoteJournal(scratch);try{expect(after.entries()).toEqual([])}finally{after.close()}
  const stat=await readFile(`/proc/${pid}/stat`,"utf8").catch(()=>"")
  expect(stat===""||stat.split(") ")[1]?.startsWith("Z")).toBe(true)
 }finally{supervisorLines.close();supervisor.kill("SIGKILL");if(pid)try{process.kill(-pid,"SIGKILL")}catch{};await rm(root,{recursive:true,force:true})}
},45000)
