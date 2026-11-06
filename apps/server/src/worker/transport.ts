import {createHash,timingSafeEqual} from "node:crypto"
export const workerCompletionLimit=8*1024*1024
export const workerArtifactLimit=524288000
export function workerAuthorized(authorization:string|null|undefined,secret:string):boolean{
 const digest=(value:string)=>createHash("sha256").update(value).digest()
 return timingSafeEqual(digest(authorization ?? ""),digest(`Bearer ${secret}`))
}
