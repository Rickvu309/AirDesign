import assert from "node:assert/strict"

export function validateMcpMetadata(value:unknown,studio:string,mcp:string) {
  assert.ok(value && typeof value==="object" && "resource" in value && "authorization_servers" in value,"invalid protected-resource metadata")
  assert.equal(value.resource,mcp+"/mcp","MCP resource audience must use the MCP origin")
  assert.deepEqual(value.authorization_servers,[studio],"MCP authorization server must use the Studio origin")
}
