import {createHash} from "node:crypto"
import {rm} from "node:fs/promises"
import path from "node:path"
import type {HistoryStore} from "../../../server/src/db/history-store.ts"
import type {OperationStore} from "../../../../packages/operations/src/index.ts"
import type {TemplateStore} from "../../../../packages/brand/src/template-store.ts"
export async function deliverAccountDeletion(history:Pick<HistoryStore,"deletions">,operations:OperationStore,images:OperationStore,templates:TemplateStore,root:string,signal?:AbortSignal){
  const completed:string[]=[]
  for(const job of await history.deletions.pending()){
    signal?.throwIfAborted()
    if(operations.ownerRunning(job.owner)||images.ownerRunning(job.owner))continue
    operations.deleteOwner(job.owner);images.deleteOwner(job.owner);templates.deleteOwner(job.owner)
    await rm(path.join(root,createHash("sha256").update(job.owner).digest("hex")),{recursive:true,force:true})
    if(await history.deletions.purge(job.owner))completed.push(createHash("sha256").update(job.owner).digest("hex"))
  }
  return completed
}
