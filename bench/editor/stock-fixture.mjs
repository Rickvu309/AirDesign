import {assetProviders} from "../../packages/files/src/assets/providers.ts"
import {OperationStore,operationId} from "../../packages/operations/src/index.ts"
import {readImageJob} from "../../packages/files/src/assets/image-job.ts"
import {validateImage,serializeValidatedImage} from "../../packages/files/src/assets/validate.ts"

export async function seedStockImages(local,owner){
  const queue=new OperationStore(local.fixture.operationsPath+".images",local.fixture.now)
  try{
    for(const item of assetProviders.find(provider=>provider.id==="local-stock").search("")){
      const job=await local.request(owner,"/api/assets/provider",{provider:"local-stock",item:item.id,requestId:"stock_"+item.id},202),id=operationId(job.id),lease=queue.claim(id)
      if(!lease)throw new Error("stock-image-not-queued")
      const input=readImageJob(lease.input),image=await validateImage(input.bytes)
      queue.complete(id,lease.lease,serializeValidatedImage(image,input.provenance))
      await local.request(owner,"/api/assets/jobs/"+job.id+"/adopt",{})
    }
  }finally{queue.close()}
}
