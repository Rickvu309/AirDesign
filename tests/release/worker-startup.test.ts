import {it,expect} from "vitest"
import {mkdtemp,cp,symlink,mkdir,rm,writeFile} from "node:fs/promises"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import path from "node:path"
import os from "node:os"
it("worker refuses startup before touching queues when the built renderer is missing",async()=>{
  const root=await mkdtemp(path.join(os.homedir(),"tmp/airdesign-worker-startup-"))
  try{
    await mkdir(path.join(root,"apps/worker"),{recursive:true})
    await cp("apps/worker/src",path.join(root,"apps/worker/src"),{recursive:true})
    await symlink(path.resolve("packages"),path.join(root,"packages"))
    await symlink(path.resolve("node_modules"),path.join(root,"node_modules"))
    await symlink(path.resolve("apps/server"),path.join(root,"apps/server"))
    await writeFile(path.join(root,"package.json"),JSON.stringify({type:"module"}))
    const env:NodeJS.ProcessEnv={...process.env,AIRDESIGN_OPERATIONS_PATH:path.join(root,"queue.sqlite"),AIRDESIGN_WORKER_TEMP:path.join(root,"jobs")};delete env.AIRDESIGN_DATABASE_URL
    await expect(promisify(execFile)(process.execPath,[path.join(root,"apps/worker/src/main.ts")],{env})).rejects.toMatchObject({code:1,stderr:expect.stringContaining("PDF renderer missing. Run npm run build before starting the worker.")})
  }finally{await rm(root,{recursive:true,force:true})}
})
