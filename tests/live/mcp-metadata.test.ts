import {expect,it} from "vitest"
import {validateMcpMetadata} from "../../scripts/live/mcp-metadata.ts"

const studio="https://studio.example.invalid",mcp="https://mcp.example.invalid"
it("accepts a distinct Studio authorization origin and MCP resource audience",()=>{
  expect(()=>validateMcpMetadata({resource:mcp+"/mcp",authorization_servers:[studio]},studio,mcp)).not.toThrow()
})
it("rejects the original conflation of MCP and authorization origins",()=>{
  expect(()=>validateMcpMetadata({resource:mcp+"/mcp",authorization_servers:[mcp]},studio,mcp)).toThrow("Studio origin")
})
it("rejects an incorrect resource audience",()=>{
  expect(()=>validateMcpMetadata({resource:studio+"/mcp",authorization_servers:[studio]},studio,mcp)).toThrow("MCP origin")
})
