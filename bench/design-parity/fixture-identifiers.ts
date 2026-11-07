import {createHash} from "node:crypto"
export function fixtureIdentifier(screen:string,index:number):`${string}-${string}-${string}-${string}-${string}` {
  const hash=createHash("sha256").update(`${screen}:${index}`).digest("hex")
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`
}
