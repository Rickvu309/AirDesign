import {execFileSync} from "node:child_process"

export function createBuildIdentity(): {sha:string;builtAt:string} {
  const sha=process.env.AIRDESIGN_BUILD_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
  const builtAt=process.env.AIRDESIGN_BUILD_TIME || new Date().toISOString()
  if(!/^[a-f0-9]{40}$/.test(sha)||!Number.isFinite(Date.parse(builtAt)))throw new Error("invalid-build-identity")
  return {sha,builtAt}
}

export {readBuildIdentity} from "../../packages/operations/src/build-identity.ts"
