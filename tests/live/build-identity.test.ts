import {afterEach,beforeEach,expect,it,vi} from "vitest"
import {readFile} from "node:fs/promises"
import {execFileSync} from "node:child_process"
import {createBuildIdentity,readBuildIdentity} from "../../scripts/live/build-identity.ts"

vi.mock("node:fs/promises",()=>({readFile:vi.fn()}))
vi.mock("node:child_process",()=>({execFileSync:vi.fn()}))
const identity={sha:"a".repeat(40),builtAt:"2026-11-07T00:00:00.000Z"}
beforeEach(()=>{vi.stubEnv("NODE_ENV","production");vi.clearAllMocks()})
afterEach(()=>vi.unstubAllEnvs())
it("reports the baked build even when runtime variables describe another commit",async()=>{
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(identity))
  vi.stubEnv("AIRDESIGN_BUILD_SHA","b".repeat(40))
  vi.stubEnv("RAILWAY_GIT_COMMIT_SHA","c".repeat(40))
  expect(await readBuildIdentity()).toEqual(identity)
  expect(execFileSync).not.toHaveBeenCalled()
})
it("refuses a missing identity in production instead of reporting a runtime timestamp",async()=>{
  vi.mocked(readFile).mockRejectedValue(new Error("missing-artifact"))
  await expect(readBuildIdentity()).rejects.toThrow("missing-artifact")
  expect(execFileSync).not.toHaveBeenCalled()
})
it("refuses malformed baked identities",async()=>{
  for(const value of [{...identity,sha:"main"},{...identity,builtAt:"unknown"},null]){
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(value))
    await expect(readBuildIdentity()).rejects.toThrow("invalid-build-identity")
  }
})
it("bakes the build checkout instead of reusing an older artifact",()=>{
  vi.stubEnv("AIRDESIGN_BUILD_SHA","");vi.stubEnv("RAILWAY_GIT_COMMIT_SHA","");vi.stubEnv("AIRDESIGN_BUILD_TIME",identity.builtAt)
  vi.mocked(execFileSync).mockReturnValue(identity.sha+"\n")
  vi.mocked(readFile).mockResolvedValue(JSON.stringify({...identity,sha:"b".repeat(40)}))
  expect(createBuildIdentity()).toEqual(identity)
})
it("accepts the deployment build SHA without requiring git in the image",()=>{
  vi.stubEnv("AIRDESIGN_BUILD_SHA","");vi.stubEnv("RAILWAY_GIT_COMMIT_SHA",identity.sha);vi.stubEnv("AIRDESIGN_BUILD_TIME",identity.builtAt)
  expect(createBuildIdentity()).toEqual(identity)
  expect(execFileSync).not.toHaveBeenCalled()
})
