import {createServer} from "node:net"
import {expect,it} from "vitest"
import {createWithBrowserOrigin} from "./browser-origin.ts"
async function available(origin:string):Promise<boolean>{
  const probe=createServer()
  const bound=await new Promise<boolean>(resolve=>{probe.once("error",()=>resolve(false));probe.listen(Number(new URL(origin).port),"127.0.0.1",()=>resolve(true))})
  if(bound)await new Promise<void>(resolve=>probe.close(()=>resolve()))
  return bound
}
it("keeps the browser origin reserved while the API starts, then releases it",async()=>{
  const origin=await createWithBrowserOrigin(async origin=>{expect(await available(origin)).toBe(false);return origin})
  expect(await available(origin)).toBe(true)
})
it("releases the browser port when API startup fails",async()=>{
  let reserved=""
  await expect(createWithBrowserOrigin(async origin=>{reserved=origin;throw new Error("api-start-failed")})).rejects.toThrow("api-start-failed")
  expect(await available(reserved)).toBe(true)
})
