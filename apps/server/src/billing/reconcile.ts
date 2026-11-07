import {readFile} from "node:fs/promises"
import {z} from "zod"
import {createHistoryStore} from "../db/history-store.ts"
import {localPaymentProvider} from "../../../../packages/usage/src/payments/provider.ts"
const schema=z.object({owner:z.string().min(1),id:z.string().min(1),payments:z.array(z.object({body:z.string().max(10000),signature:z.string()})).max(1000),model:z.array(z.object({reservation:z.string(),units:z.number().int().nonnegative(),actor:z.enum(["aira","user-agent"])})).max(1000)})
const filename=process.argv[2],url=process.env.AIRDESIGN_DATABASE_URL,fixtureSecret=process.env.AIRDESIGN_PAYMENT_FIXTURE_SECRET
if(!filename||!url||!fixtureSecret)throw new Error("usage: AIRDESIGN_DATABASE_URL=... AIRDESIGN_PAYMENT_FIXTURE_SECRET=... node apps/server/src/billing/reconcile.ts fixture.json")
const input=schema.parse(JSON.parse(await readFile(filename,"utf8")))
const provider=localPaymentProvider(fixtureSecret)
const history=await createHistoryStore({kind:"postgres",url,schema:"migrate"})
try{const report=await history.usage.reconcile(input.owner,input.id,{payments:input.payments.map(item=>provider.verify(item.body,item.signature)),model:input.model});process.stdout.write(JSON.stringify(report)+"\n");if(report.missing.length||report.mismatched.length)process.exitCode=1}finally{await history.close()}
