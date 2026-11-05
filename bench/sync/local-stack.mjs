import { createServer } from "node:net"
import { spawn } from "node:child_process"
import { mkdir, rm } from "node:fs/promises"
import { once } from "node:events"
import os from "node:os"
import pg from "pg"
import { preview } from "vite"

export async function freePort() {
  const socket=createServer()
  socket.listen(0,"127.0.0.1");await once(socket,"listening")
  const port=socket.address().port
  await new Promise(resolve=>socket.close(resolve))
  return port
}

export async function localStack() {
  const folder=`${os.homedir()}/tmp/p04-stack-${process.pid}-${crypto.randomUUID()}`
  await mkdir(folder,{recursive:true})
  const host=process.env.AIRDESIGN_PG_HOST ?? `${os.homedir()}/.local/pg/sock`
  const user=process.env.AIRDESIGN_PG_USER ?? os.userInfo().username
  const database=`p04_sync_${crypto.randomUUID().replaceAll("-","")}`
  const admin=new pg.Client({host,user,database:"postgres"})
  await admin.connect();await admin.query(`CREATE DATABASE ${database}`)
  const url=`postgresql://${user}@/${database}?host=${host}`
  const studioPort=await freePort(), apiPort=await freePort()
  const origin=`http://127.0.0.1:${studioPort}`, api=`http://127.0.0.1:${apiPort}`
  let child
  async function start() {
    child=spawn(process.execPath,["apps/server/src/main.ts"],{env:{...process.env,PORT:String(apiPort),AIRDESIGN_DATABASE_URL:url,AIRDESIGN_PUBLIC_ORIGIN:origin,AIRDESIGN_EXPOSE_INBOX:"1",AIRDESIGN_OPERATIONS_PATH:`${folder}/operations.sqlite`},stdio:["ignore","pipe","pipe"]})
    await new Promise((resolve,reject)=>{
      let output=""
      child.stdout.on("data",data=>{output+=data.toString();if(output.includes(`listening ${apiPort}`))resolve()})
      child.stderr.on("data",data=>{output+=data.toString()})
      child.once("exit",code=>reject(new Error(`server-exited-${code}: ${output.slice(-1500)}`)))
    })
  }
  async function stop() { if(child && child.exitCode===null){const ended=once(child,"exit");child.kill("SIGTERM");await ended} }
  let studio
  try {
    await start()
    studio=await preview({root:"apps/studio",configFile:false,preview:{host:"127.0.0.1",port:studioPort,strictPort:true,proxy:{"/api":api,"/ws":{target:api,ws:true}}}})
  } catch(error) {await stop();await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);await admin.end();await rm(folder,{recursive:true,force:true});throw error}
  return {origin,api,url,operationsPath:`${folder}/operations.sqlite`,async restart(){await stop();await start()},async database(work){const client=new pg.Client({connectionString:url});await client.connect();try{return await work(client)}finally{await client.end()}},async close(){await studio.close();await stop();await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);await admin.end();await rm(folder,{recursive:true,force:true})}}
}

export async function signIn(context, origin, email) {
  const request=context.request
  const headers={origin}
  const intent=await (await request.post(`${origin}/api/access/intent`,{headers,data:{kind:"home"}})).json()
  await request.post(`${origin}/api/access/email`,{headers,data:{email,intent:intent.token}})
  const inbox=await (await request.get(`${origin}/api/dev/inbox?to=${encodeURIComponent(email)}`)).json()
  const response=await request.post(`${origin}/api/access/code`,{headers,data:{email,intent:intent.token,code:inbox.messages.at(-1).code}})
  const account=await response.json()
  if(account.status!=="signed-in")throw new Error(`sign-in-failed: ${JSON.stringify(account)}`)
  return (await (await request.get(`${origin}/api/account`)).json()).personId
}
