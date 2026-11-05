import { spawn } from "node:child_process"
import path from "node:path"
import os from "node:os"
import { mkdir, rm, rmdir } from "node:fs/promises"
import { OperationStore } from "../../../packages/operations/src/index.ts"
import { deliver } from "./isolation.ts"
const database = process.env.AIRDESIGN_OPERATIONS_PATH ?? path.join(os.homedir(), ".local/share/airdesign/operations.sqlite")
const root = process.env.AIRDESIGN_WORKER_TEMP ?? path.join(os.homedir(), "tmp/airdesign-jobs")
await mkdir(root, { recursive: true, mode: 0o700 })
const store = new OperationStore(database)
try {
  for (const recovered of store.recover()) {
    await new Promise<void>(resolve => {
      const killer = spawn("systemctl", ["--user", "kill", "--signal=SIGKILL", `airdesign-${recovered.id}-${recovered.lease}.scope`], { stdio: "ignore" })
      killer.once("exit", () => resolve())
      killer.once("error", () => resolve())
    })
    const directory = path.join(root,recovered.ownerDirectory,recovered.id,recovered.lease)
    await rm(directory, { recursive: true, force: true })
    await rmdir(path.dirname(directory)).catch(() => undefined)
    await rmdir(path.dirname(path.dirname(directory))).catch(() => undefined)
  }
  for (const id of store.pending()) {
    const committed = await deliver(store, id, root, path.resolve(import.meta.dirname,"import.ts"))
    process.stdout.write(JSON.stringify({ id, committed }) + "\n")
  }
} finally { store.close() }
