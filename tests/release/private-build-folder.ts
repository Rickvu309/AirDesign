import {mkdtemp,rm} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
export async function withPrivateBuildFolder<Result>(build:(outDir:string)=>void,use:(outDir:string)=>Promise<Result>):Promise<Result>{
 const outDir=await mkdtemp(path.join(os.tmpdir(),"private-build-"))
 try{
  build(outDir)
  return await use(outDir)
 }finally{await rm(outDir,{recursive:true,force:true})}
}
