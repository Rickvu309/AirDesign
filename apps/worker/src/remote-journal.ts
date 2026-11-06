import {DatabaseSync} from "node:sqlite"
import {mkdirSync,readFileSync} from "node:fs"
import {rm,rmdir} from "node:fs/promises"
import {spawn} from "node:child_process"
import path from "node:path"
import {z} from "zod"
const entry=z.object({id:z.string().uuid(),lease:z.string().uuid(),queue:z.enum(["import","image"]),database:z.string(),directory:z.string().nullable(),unit:z.string().nullable(),pid:z.number().nullable(),identity:z.string().nullable(),mode:z.enum(["container","systemd"])})
function identity(pid:number):string|null{
 try{return readFileSync(`/proc/${pid}/stat`,"utf8").split(") ")[1]?.split(" ")[19] ?? null}catch{return null}
}
export class RemoteJournal{
 private db:DatabaseSync
 constructor(root:string){
  mkdirSync(root,{recursive:true,mode:0o700})
  this.db=new DatabaseSync(path.join(root,"remote-jobs.sqlite"))
  this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS jobs(lease TEXT PRIMARY KEY,entry TEXT NOT NULL)")
 }
 entries(){return this.db.prepare("SELECT entry FROM jobs").all().map(row=>entry.parse(JSON.parse(z.string().parse(row.entry))))}
 save(job:z.infer<typeof entry>){this.db.prepare("INSERT OR REPLACE INTO jobs VALUES(?,?)").run(job.lease,JSON.stringify(entry.parse(job)))}
 started(lease:string,process:{directory:string;unit:string;pid:number}){
  const job=this.entries().find(job=>job.lease===lease)
  if(!job)throw new Error("missing-remote-journal")
  this.save({...job,...process,identity:identity(process.pid)})
 }
 async clean(job:z.infer<typeof entry>){
  if(job.mode==="container"&&job.pid&&(identity(job.pid)===null||job.identity===identity(job.pid))){
   try{process.kill(-job.pid,"SIGKILL")}catch(error){if(!(error instanceof Error&&"code" in error&&error.code==="ESRCH"))throw error}
  }
  if(job.mode==="systemd"&&job.unit)await new Promise<void>((resolve,reject)=>{
   const child=spawn("systemctl",["--user","kill","--signal=SIGKILL",job.unit ?? ""],{stdio:"ignore"})
   child.once("error",reject);child.once("exit",()=>resolve())
  })
  if(job.directory){
   await rm(job.directory,{recursive:true,force:true})
   await rmdir(path.dirname(job.directory)).catch(()=>undefined)
   await rmdir(path.dirname(path.dirname(job.directory))).catch(()=>undefined)
  }
  for(const suffix of ["","-wal","-shm"])await rm(job.database+suffix,{force:true})
 }
 forget(lease:string){this.db.prepare("DELETE FROM jobs WHERE lease=?").run(lease)}
 close(){this.db.close()}
}
