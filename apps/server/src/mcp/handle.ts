import {paragraphFeatureAdmission} from "../rpc/paragraph-boundary.ts"
import type {ParagraphHistoryStore} from "../db/paragraph-history-store.ts"
import {createHash} from "node:crypto"
import {Server} from "@modelcontextprotocol/sdk/server/index.js"
import {WebStandardStreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import {CallToolRequestSchema,ListToolsRequestSchema,ListResourcesRequestSchema,ListResourceTemplatesRequestSchema,ReadResourceRequestSchema,McpError,ErrorCode} from "@modelcontextprotocol/sdk/types.js"
import {toolCatalog,mcpPin} from "../../../../packages/tools/src/catalog.ts"
import {textResult,toolTextLimit} from "../../../../packages/tools/src/snapshots.ts"
import {domainTools} from "./domain-tools.ts"
import {mutationRejection,type Access} from "@airdesign/access"
import type {HistoryStore} from "../db/history-store.ts"
import type {TemplateStore} from "../../../../packages/brand/src/template-store.ts"
import type {OperationStore} from "../../../../packages/operations/src/index.ts"
export function mcpHandler(access:Access,history:HistoryStore,templates:TemplateStore,operations:OperationStore,imageQueue:OperationStore,origin:string,secret:string,changed:(deck:string)=>Promise<void>,resourceOrigin=origin,paragraphs?:ParagraphHistoryStore){
  const oauth=history.oauth(secret,resourceOrigin+"/mcp"),tools=domainTools(history,templates,operations,imageQueue,origin,changed,paragraphs)
  return {
    close:()=>tools.close(),
    async handle(request:Request):Promise<Response>{
      const url=new URL(request.url)
      if(url.origin!==origin || request.headers.has("origin")&&request.headers.get("origin")!==origin)return Response.json({code:"untrusted-origin"},{status:403})
      if(url.pathname==="/api/mcp/uploads"&&request.method==="POST"){
        const rejected=mutationRejection(request,origin,["application/json","application/octet-stream"]);if(rejected)return Response.json(rejected,{status:rejected.status})
        const principal=await access.principal(request);if(!principal)return Response.json({code:"signed-out"},{status:401})
        const admission=await paragraphFeatureAdmission(paragraphs,request);if(admission)return admission
        try{
          const mime=request.headers.get("content-type")?.split(";")[0] ?? ""
          let name:string,requestId:string,bytes:Buffer
          if(mime==="application/json"){
            const body:unknown=await request.json()
            if(!body||typeof body!=="object"||!("name" in body)||typeof body.name!=="string"||!("requestId" in body)||typeof body.requestId!=="string"||!("text" in body)||typeof body.text!=="string"||Object.keys(body).some(key=>!["name","requestId","text"].includes(key)))throw new Error("invalid-upload")
            name=body.name;requestId=body.requestId;bytes=Buffer.from(body.text)
          }else if(mime==="application/octet-stream"){name=url.searchParams.get("name") ?? "";requestId=url.searchParams.get("requestId") ?? "";bytes=Buffer.from(await request.arrayBuffer())}
          else throw new Error("invalid-upload-type")
          const contentType=mime==="application/json" ? "text/plain" : "application/octet-stream"
          const input=JSON.stringify({name,mime:contentType,sha256:createHash("sha256").update(bytes).digest("hex")})
          const file=await history.files.save(principal.personId,requestId,input,name,async()=>({bytes,mime:contentType}))
          return Response.json({...file,sourceUrl:`${origin}/api/mcp/files/${file.fileId}`},{status:201})
        }catch(error){return Response.json({code:error instanceof Error ? error.message : "upload-failed"},{status:400})}
      }
      if(url.pathname!=="/mcp")return Response.json({code:"not-found"},{status:404})
      const authorization=request.headers.get("authorization"),principal=authorization?.startsWith("Bearer ") ? await oauth.authenticate(authorization.slice(7),resourceOrigin+"/mcp") : null
      if(!principal)return Response.json({code:"invalid-token"},{status:401,headers:{"www-authenticate":`Bearer resource_metadata="${resourceOrigin}/.well-known/oauth-protected-resource/mcp"`}})
      const admission=await paragraphFeatureAdmission(paragraphs,request);if(admission)return admission
      const protocol=request.headers.get("mcp-protocol-version")
      if(protocol&&protocol!==mcpPin.protocol)return Response.json({code:"unsupported-protocol-version",supported:[mcpPin.protocol]},{status:400})
      if(request.method==="POST"){
        const body:unknown=await request.clone().json().catch(()=>null)
        if(body&&typeof body==="object"&&"method" in body&&body.method==="initialize"&&(!("params" in body)||!body.params||typeof body.params!=="object"||!("protocolVersion" in body.params)||body.params.protocolVersion!==mcpPin.protocol))return Response.json({code:"unsupported-protocol-version",supported:[mcpPin.protocol]},{status:400})
      }
      const server=new Server({name:"AirDesign",version:"0.1.0"},{capabilities:{tools:{},resources:{}}})
      server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:toolCatalog}))
      server.setRequestHandler(ListResourcesRequestSchema,async()=>({resources:[]}))
      server.setRequestHandler(ListResourceTemplatesRequestSchema,async()=>({resourceTemplates:[{name:"Owned file chunks",uriTemplate:"airdesign://files/{fileId}{?offset}",mimeType:"application/octet-stream"},{name:"Owned export chunks",uriTemplate:"airdesign://exports/{operationId}{?offset}",mimeType:"application/octet-stream"},{name:"Owned import chunks",uriTemplate:"airdesign://imports/{operationId}{?offset}",mimeType:"application/octet-stream"},{name:"Owned image chunks",uriTemplate:"airdesign://images/{operationId}{?offset}",mimeType:"application/octet-stream"},{name:"Owned capture chunks",uriTemplate:"airdesign://captures/{captureId}{?offset}",mimeType:"image/png"},{name:"Saved subtree chunks",uriTemplate:"airdesign://snapshots/{snapshot}{?index,offset}",mimeType:"application/json"}]}))
      server.setRequestHandler(CallToolRequestSchema,async call=>{
        try{const result=await tools.call(principal,call.params.name,call.params.arguments ?? {});if(Buffer.byteLength(JSON.stringify(result))>(result.content.some(item=>item.type==="image") ? 500000 : toolTextLimit))throw new Error("result-too-large-use-target-or-resource");return result}
        catch(error){const admission=await paragraphFeatureAdmission(paragraphs,request);if(admission)return textResult(await admission.json(),true);return textResult({code:error instanceof Error ? error.message.slice(0,200) : "tool-failed",retryable:false},true)}
      })
      server.setRequestHandler(ReadResourceRequestSchema,async request=>{try{const result=await tools.resource(principal,request.params.uri);if(Buffer.byteLength(JSON.stringify(result))>toolTextLimit)throw new Error("resource-envelope-limit");return result}catch{throw new McpError(ErrorCode.InvalidParams,"resource-not-found-or-invalid-page")}})
      const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true})
      await server.connect(transport)
      try{return await transport.handleRequest(request)}finally{await server.close()}
    },
  }
}
