import {spawn} from "node:child_process"
import {setTimeout} from "node:timers/promises"
import {isolationMode} from "./container-process.ts"

isolationMode()
if (!(process.env.DATABASE_URL ?? process.env.AIRDESIGN_DATABASE_URL)) throw new Error("Missing required environment: DATABASE_URL")
if (!process.env.AIRDESIGN_OPERATIONS_PATH) throw new Error("Missing required environment: AIRDESIGN_OPERATIONS_PATH")
for (const name of ["AIRDESIGN_WORKER_API_ORIGIN","AIRDESIGN_SECRET"]) if (!process.env[name]) throw new Error(`Missing required environment: ${name}`)
if ((process.env.AIRDESIGN_SECRET?.length ?? 0) < 32) throw new Error("AIRDESIGN_SECRET must contain at least 32 characters")
let stopping = false
let child: ReturnType<typeof spawn> | undefined
for (const signal of ["SIGTERM","SIGINT"] as const) process.on(signal,() => { stopping = true; child?.kill(signal) })
while (!stopping) {
  child = spawn(process.execPath,[new URL("./main.ts",import.meta.url).pathname],{stdio:"inherit",env:{...process.env,AIRDESIGN_DATABASE_URL:process.env.DATABASE_URL ?? process.env.AIRDESIGN_DATABASE_URL}})
  const code = await new Promise<number|null>((resolve,reject) => { child?.once("exit",resolve); child?.once("error",reject) })
  child = undefined
  if (code !== 0 && !stopping) throw new Error(`worker-cycle-failed:${code}`)
  if (!stopping) await setTimeout(1000)
}
