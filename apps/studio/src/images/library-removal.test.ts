import { afterEach,expect,it,vi } from "vitest"
import { mutationRejection } from "../../../../packages/access/src/mutation-guard.ts"
import { api } from "../decks/catalog-client.ts"

afterEach(()=>vi.unstubAllGlobals())

it("removes a library listing through the server's JSON mutation boundary",async()=>{
  vi.stubGlobal("fetch",async(path:string,init:RequestInit)=>{
    const request=new Request("http://localhost"+path,{...init,headers:{...init.headers,origin:"http://localhost"}}),rejection=mutationRejection(request,"http://localhost")
    return rejection ? Response.json(rejection,{status:rejection.status}) : Response.json({removed:true})
  })
  await expect(api("/api/assets/owned",undefined,"DELETE")).resolves.toEqual({removed:true})
})
