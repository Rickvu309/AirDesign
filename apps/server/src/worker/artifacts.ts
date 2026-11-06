import {mkdir,open,readFile,rename,rm,rmdir} from "node:fs/promises"
import path from "node:path"
import {workerArtifactLimit} from "./transport.ts"

export class WorkerArtifacts{
  private ready:Promise<void>
  private root:string
  constructor(root:string){this.root=root;this.ready=rm(root,{recursive:true,force:true})}
  async upload(request:Request,lease:string):Promise<Response>{
    await this.ready
    const length=request.headers.get("content-length")
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>workerArtifactLimit)){await request.body?.cancel();return Response.json({code:"artifact-limit"},{status:413})}
    if(!request.body)return Response.json({code:"artifact-required"},{status:400})
    await mkdir(this.root,{recursive:true,mode:0o700})
    const temporary=path.join(this.root,lease+".upload"),destination=path.join(this.root,lease)
    const file=await open(temporary,"wx",0o600)
    const reader=request.body.getReader()
    let size=0,finished=false
    try{
      for(;;){
        const chunk=await reader.read()
        if(chunk.done)break
        size+=chunk.value.byteLength
        if(size>workerArtifactLimit){await reader.cancel();return Response.json({code:"artifact-limit"},{status:413})}
        await file.writeFile(chunk.value)
      }
      await file.close()
      await rename(temporary,destination)
      finished=true
      return Response.json({ok:true})
    }finally{
      reader.releaseLock()
      if(!finished){await file.close();await rm(temporary,{force:true});await rmdir(this.root).catch(()=>undefined)}
    }
  }
  async erase(lease:string){await this.ready;await rm(path.join(this.root,lease),{force:true});await rmdir(this.root).catch(()=>undefined)}
  async take(lease:string){
    await this.ready
    try{return await readFile(path.join(this.root,lease))}catch(error){if(error instanceof Error&&"code" in error&&error.code==="ENOENT")return null;throw error}
    finally{await this.erase(lease)}
  }
}
