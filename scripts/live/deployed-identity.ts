import assert from "node:assert/strict"
import {z} from "zod"

const identitySchema=z.object({sha:z.string(),builtAt:z.string()})

export async function checkIdentity(base:string,route:string,sha:string,waitForPropagation=false){
  const deadline=performance.now()+(waitForPropagation ? 120000 : 15000)
  let observed="no response"
  for(;;){
    const remaining=deadline-performance.now()
    assert.ok(remaining>0,`deployed commit does not match --expect-sha after propagation limit: expected ${sha}, observed ${observed}`)
    const response=await fetch(new URL(route,base),{cache:"no-store",signal:AbortSignal.timeout(Math.max(1,Math.ceil(Math.min(15000,remaining))))})
    assert.equal(response.status,200,"version endpoint must return 200")
    const value=identitySchema.parse(await response.json())
    assert.ok(Number.isFinite(Date.parse(value.builtAt)),"build time missing")
    assert.ok(performance.now()<deadline,"deployed commit does not match --expect-sha within identity deadline")
    if(value.sha===sha)return value
    observed=value.sha
    if(!waitForPropagation)assert.equal(observed,sha,"deployed commit does not match --expect-sha")
    await new Promise<void>(resolve=>setTimeout(resolve,Math.min(2000,Math.max(0,deadline-performance.now()))))
  }
}
