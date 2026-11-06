import {createHash,timingSafeEqual} from "node:crypto"
export const workerCompletionLimit=Math.ceil(524288000/3)*4+6*8*1024*1024+65536
export function workerAuthorized(authorization:string|null|undefined,secret:string):boolean{
 const digest=(value:string)=>createHash("sha256").update(value).digest()
 return timingSafeEqual(digest(authorization ?? ""),digest(`Bearer ${secret}`))
}
