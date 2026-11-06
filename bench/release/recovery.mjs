import assert from "node:assert/strict"
import {mkdtemp,copyFile,rm,mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {once} from "node:events"
import {fork,execFileSync} from "node:child_process"
import {OperationStore} from "../../packages/operations/src/index.ts"
const root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),directory=await mkdtemp(path.join(os.homedir(),"tmp/p09-recovery-")),owner={personId:"disposable-owner"},foreign={personId:"foreign-owner"}
let clock=Date.now(),store=new OperationStore(path.join(directory,"live.sqlite"),()=>clock)
try{
 const job=store.submit(owner,"restore-fixture",Buffer.from("synthetic input")),child=fork("bench/release/worker-fixture.mjs",[path.join(directory,"live.sqlite"),job.id],{stdio:["ignore","ignore","inherit","ipc"]}),[{lease:first}]=await once(child,"message");assert.ok(first)
 const ended=once(child,"exit");child.kill("SIGKILL");const [exitCode,signal]=await ended;assert.equal(signal,"SIGKILL");assert.equal(exitCode,null)
 const recovered=store.recover();assert.equal(recovered.length,1);assert.equal(store.claim(job.id),null);store.acknowledgeCleanup(job.id,first.lease)
 const retry=store.claim(job.id);assert.ok(retry);assert.notEqual(retry.lease,first.lease);assert.equal(store.complete(job.id,first.lease,Buffer.from("stale")),false);assert.equal(store.complete(job.id,retry.lease,Buffer.from("restored output")),true)
 store.close();await copyFile(path.join(directory,"live.sqlite"),path.join(directory,"backup.sqlite"));await copyFile(path.join(directory,"backup.sqlite"),path.join(directory,"restore.sqlite"))
 store=new OperationStore(path.join(directory,"restore.sqlite"),()=>clock);assert.equal(store.artifact(owner,job.id).toString(),"restored output");assert.throws(()=>store.status(foreign,job.id));assert.throws(()=>store.deleteOwner(owner.personId),/account-operation-still-running/);store.acknowledgeCleanup(job.id,retry.lease);store.deleteOwner(owner.personId);assert.throws(()=>store.status(owner,job.id));store.close()
 store=new OperationStore(path.join(directory,"restore.sqlite"),()=>clock);assert.throws(()=>store.artifact(owner,job.id));store.close()
 store=new OperationStore(path.join(directory,"live.sqlite"),()=>clock);clock+=7*86400000+1;assert.equal(store.status(owner,job.id).kind,"expired");assert.throws(()=>store.artifact(owner,job.id))
 await mkdir(path.join(root,"recovery"),{recursive:true});await writeFile(path.join(root,"recovery/receipt.json"),JSON.stringify({head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),status:"pass",scope:"disposable operation SQLite only",backup:"quiescent close then copy",restore:"reopened copy returns exact artifact",deletion:"survives reopen and refuses artifact",isolation:"foreign principal refused",interruption:"actual disposable worker SIGKILL, dead-holder recovery, retry cleanup barrier and stale-worker fencing verified",retention:"seven-day artifact expired",rollbackBoundary:"Never restore old account data without replaying deletion tombstones; no production rollback or production killed-worker claim",cleanup:directory},null,2));console.log(JSON.stringify({recovery:"pass",cleanup:directory}))
}finally{store.close();await rm(directory,{recursive:true,force:true})}
