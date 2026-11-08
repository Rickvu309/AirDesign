import {StringDecoder} from "node:string_decoder"
import type {Writable} from "node:stream"
import type {OperationStore,OperationId} from "../../../packages/operations/src/index.ts"
import {importProgressPrefix,importSlideProgressSchema,type ImportSlideProgress} from "../../../packages/operations/src/import-progress.ts"

export class ImportProgressWriter {
  private pending:ImportSlideProgress|undefined
  private blocked=false
  private failure:Error|undefined
  private output:Writable
  constructor(output:Writable) {
    this.output=output
    output.on("drain",()=>{this.blocked=false;this.writePending()})
    output.on("error",error=>{this.failure=error})
  }
  publish(value:ImportSlideProgress):void {
    this.pending=importSlideProgressSchema.parse(value)
    this.writePending()
  }
  private writePending():void {
    if(this.blocked||!this.pending||this.failure)return
    const value=this.pending
    this.pending=undefined
    this.blocked=!this.output.write(importProgressPrefix+JSON.stringify(value)+"\n")
  }
  async flush():Promise<void> {
    if(this.failure)throw this.failure
    if(!this.blocked&&!this.pending)return
    await new Promise<void>((resolve,reject)=>{
      const finish=()=>{cleanup();resolve()}
      const error=(failure:Error)=>{cleanup();reject(failure)}
      const drain=()=>{if(!this.blocked&&!this.pending)finish()}
      const cleanup=()=>{this.output.off("drain",drain);this.output.off("error",error)}
      this.output.on("drain",drain);this.output.once("error",error)
    })
  }
}

export class ImportProgressDecoder {
  private decoder=new StringDecoder("utf8")
  private line=""
  private oversized=false
  private diagnostic=""
  private accept:(value:ImportSlideProgress)=>void
  constructor(accept:(value:ImportSlideProgress)=>void) {this.accept=accept}
  push(bytes:Buffer):void {this.text(this.decoder.write(bytes))}
  finish():void {this.text(this.decoder.end());if(this.line||this.oversized)this.endLine()}
  diagnostics():string {return this.diagnostic}
  private text(text:string):void {
    for(const character of text){
      if(character==="\n"){this.endLine();continue}
      this.line+=character
      if(this.line.length>1024){this.oversized=true;this.line=this.line.slice(-1024)}
    }
  }
  private endLine():void {
    const line=this.line
    this.line=""
    if(this.oversized){this.oversized=false;this.diagnostic=(this.diagnostic+"oversized-worker-line:"+line+"\n").slice(-2000);return}
    if(line.startsWith(importProgressPrefix)){
      try{
        const value=importSlideProgressSchema.safeParse(JSON.parse(line.slice(importProgressPrefix.length)))
        if(value.success){this.accept(value.data);return}
      }catch{}
      this.diagnostic=(this.diagnostic+"invalid-import-progress-frame:"+line+"\n").slice(-2000)
    } else this.diagnostic=(this.diagnostic+line+"\n").slice(-2000)
  }
}

export function acceptImportProgress(store:OperationStore,id:OperationId,lease:string,value:ImportSlideProgress,forward?:(value:ImportSlideProgress)=>void):boolean {
  if(!store.recordProgress(id,lease,value))return false
  forward?.(value)
  return true
}

export class ImportProgressForwarder {
  private latest:ImportSlideProgress|undefined
  private pending:Promise<void>|undefined
  private stopped=false
  private send:(value:ImportSlideProgress,signal:AbortSignal)=>Promise<void>
  constructor(send:(value:ImportSlideProgress,signal:AbortSignal)=>Promise<void>) {this.send=send}
  publish(value:ImportSlideProgress):void {
    if(this.stopped)return
    this.latest=value
    this.start()
  }
  private start():void {
    if(this.pending||!this.latest)return
    const value=this.latest
    this.latest=undefined
    const controller=new AbortController()
    let timeout:ReturnType<typeof setTimeout>|undefined
    const deadline=new Promise<void>((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error("progress-timeout"))},1000)})
    this.pending=Promise.race([this.send(value,controller.signal),deadline]).catch(()=>{}).finally(()=>{
      clearTimeout(timeout);this.pending=undefined
      if(!this.stopped)this.start()
    })
  }
  async close():Promise<void> {this.stopped=true;this.latest=undefined;await this.pending}
}
