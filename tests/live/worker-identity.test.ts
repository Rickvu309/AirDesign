import {expect,it} from "vitest"
import {checkWorkerIdentity} from "../../scripts/live/worker-identity.ts"

it("rejects a stale worker even when site and Studio have the expected commit",()=>{
  const sha="a".repeat(40)
  expect(()=>checkWorkerIdentity({workerSha:"b".repeat(40)},sha)).toThrow("worker commit")
  expect(()=>checkWorkerIdentity({},sha)).toThrow("worker commit")
  expect(checkWorkerIdentity({workerSha:sha},sha)).toEqual({workerSha:sha})
})
