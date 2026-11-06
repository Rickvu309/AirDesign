import {afterEach,it,expect,vi} from "vitest"
import {productionEnvironment} from "../../src/runtime/environment.ts"
import {createAccess,createMemoryInbox} from "@airdesign/access"

afterEach(()=>vi.unstubAllEnvs())
it("refuses the original development defaults in production",()=>{
  vi.stubEnv("NODE_ENV","production")
  vi.stubEnv("AIRDESIGN_SECRET","")
  expect(productionEnvironment).toThrow("AIRDESIGN_SECRET")
})
it("accepts complete production configuration and refuses an exposed inbox",()=>{
  vi.stubEnv("NODE_ENV","production")
  for(const [key,value] of Object.entries({AIRDESIGN_SECRET:"test-secret-32-characters-minimum-length",DATABASE_URL:"postgres://localhost/test",AIRDESIGN_PUBLIC_ORIGIN:"https://studio.example.invalid",AIRDESIGN_MCP_ORIGIN:"https://mcp.example.invalid",RESEND_API_KEY:"mock",MAIL_FROM:"test@example.invalid",AIRDESIGN_OPERATIONS_PATH:"/data/jobs.sqlite",AIRDESIGN_EXPOSE_INBOX:"0"}))vi.stubEnv(key,value)
  expect(productionEnvironment).not.toThrow()
  vi.stubEnv("AIRDESIGN_EXPOSE_INBOX","1")
  expect(productionEnvironment).toThrow("forbidden")
})
it("refuses an inbox even when access is constructed directly",async()=>{
  vi.stubEnv("NODE_ENV","production")
  await expect(createAccess({driver:{kind:"pglite"},secret:"test-secret-32-characters-minimum-length",mail:createMemoryInbox(),clock:Date.now,guard:{allow:()=>true},exposeInbox:true})).rejects.toThrow("forbidden")
})
