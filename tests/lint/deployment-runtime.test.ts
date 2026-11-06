import {it,expect} from "vitest"
import {deploymentRuntimeHits} from "../../scripts/lint/deployment-runtime.ts"
it("rejects the original unconditional systemd worker and accepts explicit isolation selection",()=>{
 const file="apps/worker/src/isolation.ts",original='const child = spawn("systemd-run",args)'
 expect(deploymentRuntimeHits(file,original)).not.toEqual([])
 expect(deploymentRuntimeHits(file,'const child = isolationMode() === "container" ? spawnContainerJob(directory,program) : spawn("systemd-run",args)')).toEqual([])
})
it("rejects the original unconditional development inbox",()=>{
 expect(deploymentRuntimeHits("apps/server/src/main.ts","mail: inbox,")).not.toEqual([])
 expect(deploymentRuntimeHits("apps/server/src/main.ts","mail: process.env.RESEND_API_KEY ? createResendMail(config) : inbox,")).toEqual([])
})
it("rejects a fixture inbox that inherits the Vite production environment",()=>{
 const file="bench/sync/local-stack.mjs"
 expect(deploymentRuntimeHits(file,'env:{...process.env,AIRDESIGN_EXPOSE_INBOX:"1"}')).not.toEqual([])
 expect(deploymentRuntimeHits(file,'env:{...process.env,NODE_ENV:"test",AIRDESIGN_EXPOSE_INBOX:"1"}')).toEqual([])
})
it("rejects the original site build without a production Studio destination",()=>{
 const file="apps/site/vite.config.ts"
 expect(deploymentRuntimeHits(file,'transformIndexHtml:renderSiteTerms')).not.toEqual([])
 expect(deploymentRuntimeHits(file,'process.env.AIRDESIGN_STUDIO_ORIGIN ?? "https://studio.airdesign.app"')).toEqual([])
})

it("rejects deterministic production drafting and missing SDK cancellation boundary",()=>{
 expect(deploymentRuntimeHits("apps/server/src/main.ts","extras.agentAdapter ?? localAdapter")).not.toEqual([])
 expect(deploymentRuntimeHits("apps/server/src/main.ts","extras.agentAdapter ?? configuredAgent()")).toEqual([])
 expect(deploymentRuntimeHits("packages/agent/src/sdk-adapter.ts","query({options:{}})")).not.toEqual([])
 expect(deploymentRuntimeHits("packages/agent/src/sdk-adapter.ts",'abortController:controller; process.on("unhandledRejection",guard)')).toEqual([])
})

it("rejects hiding every unexpected error during Stop",()=>{
 expect(deploymentRuntimeHits("apps/server/src/agent/handle.ts",'catch(error){if(data.kind!=="stopped"){')).not.toEqual([])
 expect(deploymentRuntimeHits("apps/server/src/agent/handle.ts",'catch(error){if(data.kind!=="stopped"||!expectedAgentAbort(error,live.controller.signal)){')).toEqual([])
})

it("rejects opaque SDK arguments that hide the tool contract from the model",()=>{
 expect(deploymentRuntimeHits("packages/agent/src/harness.ts",'process.on("unhandledRejection",guard); input:z.unknown()')).not.toEqual([])
 expect(deploymentRuntimeHits("packages/agent/src/harness.ts",'process.on("unhandledRejection",guard); input:z.fromJSONSchema(definition.inputSchema)')).toEqual([])
})
