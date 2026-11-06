import {readFile} from "node:fs/promises"
import {execFileSync} from "node:child_process"

export function createBuildIdentity(): {sha:string;builtAt:string} {
  const sha=process.env.AIRDESIGN_BUILD_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
  const builtAt=process.env.AIRDESIGN_BUILD_TIME || new Date().toISOString()
  if(!/^[a-f0-9]{40}$/.test(sha)||!Number.isFinite(Date.parse(builtAt)))throw new Error("invalid-build-identity")
  return {sha,builtAt}
}

export async function readBuildIdentity(): Promise<{sha:string;builtAt:string}> {
  try {
    const value:unknown=JSON.parse(await readFile(new URL("../../build/version.json",import.meta.url),"utf8"))
    if(value && typeof value==="object" && "sha" in value && typeof value.sha==="string" && /^[a-f0-9]{40}$/.test(value.sha) && "builtAt" in value && typeof value.builtAt==="string" && Number.isFinite(Date.parse(value.builtAt))) return {sha:value.sha,builtAt:value.builtAt}
    throw new Error("invalid-build-identity")
  } catch(error) {
    if(process.env.NODE_ENV==="production") throw error
    return {sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),builtAt:new Date().toISOString()}
  }
}
