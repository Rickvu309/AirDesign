import {it,expect} from "vitest"
import {spawn} from "node:child_process"
import {once} from "node:events"
import {mkdtemp,mkdir,writeFile,cp,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"

it.each([undefined,"web","worker"])("entrypoint execs the %s app so a signal to its parent PID reaches the app handler",async role=>{
  const root=await mkdtemp(path.join(os.homedir(),"tmp/entrypoint-signal-"))
  const program='process.on("SIGTERM",()=>{process.stdout.write("handled:"+process.pid+"\\n");process.exit(42)});process.stdout.write("ready:"+process.pid+"\\n");setInterval(()=>{},1000)'
  await mkdir(path.join(root,"apps/server/src"),{recursive:true})
  await mkdir(path.join(root,"apps/worker/src"),{recursive:true})
  await writeFile(path.join(root,"apps/server/src/main.ts"),program)
  await writeFile(path.join(root,"apps/worker/src/service.ts"),program)
  await cp("scripts/docker/entrypoint.sh",path.join(root,"entrypoint.sh"))
  const env={...process.env};if(role)env.AIRDESIGN_ROLE=role;else delete env.AIRDESIGN_ROLE
  const child=spawn("sh",[path.join(root,"entrypoint.sh")],{cwd:root,env,stdio:["ignore","pipe","pipe"]})
  try{
    const [ready]=await once(child.stdout,"data",{signal:AbortSignal.timeout(10000)})
    expect(ready.toString().trim()).toBe(`ready:${child.pid}`)
    const handled=once(child.stdout,"data",{signal:AbortSignal.timeout(5000)}),exit=once(child,"exit")
    child.kill("SIGTERM")
    expect((await handled)[0].toString().trim()).toBe(`handled:${child.pid}`)
    expect((await exit)[0]).toBe(42)
  }finally{child.kill("SIGKILL");await rm(root,{recursive:true,force:true})}
})
