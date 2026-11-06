import {OperationStore,operationId} from "../../packages/operations/src/index.ts"
const store=new OperationStore(process.argv[2]),lease=store.claim(operationId(process.argv[3]))
process.send({lease})
process.on("message",()=>process.send({alive:true}))
