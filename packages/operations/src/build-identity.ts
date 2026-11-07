import {readFile} from "node:fs/promises"
import {execFileSync} from "node:child_process"

export async function readBuildIdentity(): Promise<{sha:string;builtAt:string}> {
  try {
    const value:unknown=JSON.parse(await readFile(new URL("../../../build/version.json",import.meta.url),"utf8"))
    if(value && typeof value==="object" && "sha" in value && typeof value.sha==="string" && /^[a-f0-9]{40}$/.test(value.sha) && "builtAt" in value && typeof value.builtAt==="string" && Number.isFinite(Date.parse(value.builtAt))) return {sha:value.sha,builtAt:value.builtAt}
    throw new Error("invalid-build-identity")
  } catch(error) {
    if(process.env.NODE_ENV==="production") throw error
    return {sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),builtAt:new Date().toISOString()}
  }
}
