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
