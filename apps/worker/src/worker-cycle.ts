import {drainRemoteQueue} from "./remote-queue.ts"
import {TemplateStore} from "../../../packages/brand/src/template-store.ts"
import {deliverAccountDeletion} from "./account-deletion/deliver.ts"
import { spawn } from "node:child_process"
import path from "node:path"
import os from "node:os"
import { access, mkdir, rm, rmdir } from "node:fs/promises"
import { OperationStore } from "../../../packages/operations/src/index.ts"
import { deliver } from "./isolation.ts"

export async function runWorkerCycle() {
  process.env.AIRDESIGN_DATABASE_URL ??= process.env.DATABASE_URL
  const mode=process.argv[2] ?? "all"
  if(mode!=="all"&&mode!=="images")throw new Error("unknown-worker-mode")
  await access(new URL("../dist/render.js",import.meta.url)).catch(()=>{throw new Error("PDF renderer missing. Run npm run build before starting the worker.")})
  const database = process.env.AIRDESIGN_OPERATIONS_PATH ?? path.join(os.homedir(), ".local/share/airdesign/operations.sqlite")
  const root = process.env.AIRDESIGN_WORKER_TEMP ?? (process.env.AIRDESIGN_WORKER_API_ORIGIN ? path.join(path.dirname(database),"jobs") : path.join(os.homedir(), "tmp/airdesign-jobs"))
  await mkdir(root, { recursive: true, mode: 0o700 })
  const store = new OperationStore(database)
  const images = new OperationStore(database+".images")
  try {
    if(mode==="all"&&process.env.AIRDESIGN_DATABASE_URL) {const {createHistoryStore}=await import("../../server/src/db/history-store.ts"),{purgeExpiredDecks}=await import("./purge/expired-decks.ts"),{deliverExport,recoverExports}=await import("./export/deliver.ts");const history=await createHistoryStore({kind:"postgres",url:process.env.AIRDESIGN_DATABASE_URL,schema:"connect"});try{await recoverExports(history.exports,root);if(process.env.AIRDESIGN_WORKER_API_ORIGIN)await drainRemoteQueue(process.env.AIRDESIGN_WORKER_API_ORIGIN,process.env.AIRDESIGN_SECRET ?? "",root);if(!process.env.AIRDESIGN_WORKER_API_ORIGIN){const templates=new TemplateStore(database+".templates");try{await deliverAccountDeletion(history,store,images,templates,root)}finally{templates.close()}}await purgeExpiredDecks(history.catalog);while(true){const result=await deliverExport(history.exports,root);if(!result)break;process.stdout.write(JSON.stringify(result)+"\n")}}finally{await history.close()}}
    else if(process.env.AIRDESIGN_WORKER_API_ORIGIN)await drainRemoteQueue(process.env.AIRDESIGN_WORKER_API_ORIGIN,process.env.AIRDESIGN_SECRET ?? "",root)
    for (const queue of [store,images]) for (const recovered of queue.recover()) {
      if(process.env.AIRDESIGN_ISOLATION !== "container") await new Promise<void>(resolve => {
        const killer = spawn("systemctl", ["--user", "kill", "--signal=SIGKILL", `airdesign-${recovered.id}-${recovered.lease}.scope`], { stdio: "ignore" })
        killer.once("exit", () => resolve())
        killer.once("error", () => resolve())
      })
      const directory = path.join(root,recovered.ownerDirectory,recovered.id,recovered.lease)
      await rm(directory, { recursive: true, force: true })
      queue.acknowledgeCleanup(recovered.id, recovered.lease)
      await rmdir(path.dirname(directory)).catch(() => undefined)
      await rmdir(path.dirname(path.dirname(directory))).catch(() => undefined)
    }
    for (const id of images.pending()) {
      const committed=await deliver(images,id,root,path.resolve(import.meta.dirname,"validate-image.ts"))
      process.stdout.write(JSON.stringify({id,committed,kind:"image"})+"\n")
    }
    if(mode==="all")for (const id of store.pending()) {
      const committed = await deliver(store, id, root, path.resolve(import.meta.dirname,"import.ts"))
      process.stdout.write(JSON.stringify({ id, committed }) + "\n")
    }
  } finally { images.close();store.close() }
}
