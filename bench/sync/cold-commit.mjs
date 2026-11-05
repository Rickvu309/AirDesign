import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import { createHistoryStore } from "../../apps/server/src/db/history-store.ts"
import { commandId } from "../../packages/change-log/src/index.ts"

const [url,deck,sequence]=process.argv.slice(2)
const seq=Number(sequence), started=performance.now()
const store=await createHistoryStore({kind:"postgres",url})
const initialized=performance.now()
try {
  const receipt=await store.commit({personId:"perf"},deck,{id:commandId(`perf_${seq}`),kind:"patch",base:seq,run:null,target:"s0",fields:{notes:`cold ${seq}`}})
  const finished=performance.now()
  assert.equal(receipt.kind,"applied");assert.equal(receipt.seq,seq+1)
  process.stdout.write(JSON.stringify({initializeMs:initialized-started,commitMs:finished-initialized,totalMs:finished-started,seq:receipt.seq}))
} finally {await store.close()}
