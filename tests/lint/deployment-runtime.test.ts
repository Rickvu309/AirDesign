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

it("rejects volatile remote jobs and snapshot-only Claude requests",()=>{
 expect(deploymentRuntimeHits("apps/worker/src/remote-queue.ts",'new OperationStore(":memory:")')).not.toEqual([])
 expect(deploymentRuntimeHits("apps/worker/src/remote-queue.ts",'new OperationStore(database)')).toEqual([])
 expect(deploymentRuntimeHits("packages/agent/src/sdk-adapter.ts",'abortController:controller; const prompt=JSON.stringify(context.request)')).not.toEqual([])
 expect(deploymentRuntimeHits("packages/agent/src/sdk-adapter.ts",'abortController:controller; prompt:prompt()')).toEqual([])
})

it("rejects the original export, JSON transfer and npm signal boundaries",()=>{
 expect(deploymentRuntimeHits("apps/worker/src/export/deliver.ts",'await mkdir(directory);spawnContainerJob(directory,entry)')).not.toEqual([])
 expect(deploymentRuntimeHits("apps/worker/src/export/deliver.ts",'journal.save(job);journal.started(lease,process)')).toEqual([])
 expect(deploymentRuntimeHits("apps/worker/src/remote-queue.ts",'result:store.artifact().toString("base64")')).not.toEqual([])
 expect(deploymentRuntimeHits("apps/worker/src/remote-queue.ts",'body:Readable.toWeb(stream)')).toEqual([])
 expect(deploymentRuntimeHits("Dockerfile",'CMD ["npm run start:web"]')).not.toEqual([])
 expect(deploymentRuntimeHits("Dockerfile",'ENTRYPOINT ["/app/scripts/docker/entrypoint.sh"]')).toEqual([])
 expect(deploymentRuntimeHits("scripts/docker/entrypoint.sh",'exec "$@"')).not.toEqual([])
 expect(deploymentRuntimeHits("scripts/docker/entrypoint.sh",'exec node "$entry"; --no-new-privs --bounding-set=-all --inh-caps=-all')).toEqual([])
})

it("rejects the original mutable asset caching and accepts immutable content hashes",()=>{
 const file="apps/server/src/runtime/studio.ts"
 expect(deploymentRuntimeHits(file,'"cache-control": pathname.startsWith("/assets/") ? "public, max-age=3600" : "no-store"')).not.toEqual([])
 expect(deploymentRuntimeHits(file,'"cache-control": hashedAsset ? "public, max-age=31536000, immutable" : "no-store"')).toEqual([])
})
it("rejects inherited remote worker routing in the local live-verification rehearsal",()=>{
 expect(deploymentRuntimeHits("scripts/live/local-proof.mjs",'env:{...process.env,AIRDESIGN_DATABASE_URL:localDatabase}')).not.toEqual([])
 expect(deploymentRuntimeHits("scripts/live/local-proof.mjs",'env:{...process.env,AIRDESIGN_WORKER_API_ORIGIN:"",AIRDESIGN_DATABASE_URL:localDatabase}')).toEqual([])
})
it("rejects the original live LibreOffice check that missed fresh-profile initialization",()=>{
 const file="scripts/live/verify-live.mjs"
 expect(deploymentRuntimeHits(file,'await promisify(execFile)(process.env.AIRDESIGN_LIBREOFFICE ?? fallback,args)')).not.toEqual([])
 expect(deploymentRuntimeHits(file,'await libreOfficeFastCheck(file,directory,process.env.AIRDESIGN_LIBREOFFICE ?? fallback)')).toEqual([])
})
it("rejects PDF cleanup through the document proxy",()=>{
 const file="scripts/live/verify-live.mjs"
 expect(deploymentRuntimeHits(file,'finally{await doc.destroy()}')).not.toEqual([])
 expect(deploymentRuntimeHits(file,'finally{await documentTask.destroy()}')).toEqual([])
})
it("rejects the original Trash confirmation role",()=>{
 const file="scripts/live/verify-live.mjs"
 expect(deploymentRuntimeHits(file,'page.getByRole("alertdialog")')).not.toEqual([])
 expect(deploymentRuntimeHits(file,'page.getByRole("dialog",{name:"Move deck to Trash?",exact:true})')).toEqual([])
})

it("rejects dropping an export signal and the two-second Chromium lease",()=>{
 expect(deploymentRuntimeHits("apps/worker/src/export/deliver.ts",'journal.save(job);journal.started(lease,process);child.once("exit",resolve)')).toContain("export-exit-signal: preserve the child's signal and the enforced limit")
 expect(deploymentRuntimeHits("apps/worker/src/export/deliver.ts",'journal.save(job);journal.started(lease,process);child.once("exit",(code,signal)=>resolve({code,signal}))')).toEqual([])
 expect(deploymentRuntimeHits("apps/server/src/decks/export-store.ts",'row.options.format==="pdf" ? 2000 : 30000')).not.toEqual([])
 expect(deploymentRuntimeHits("apps/server/src/decks/export-store.ts",'row.options.format==="pdf" ? exportLimits.wallMs : 30000')).toEqual([])
})

it("rejects a zero PID fallback in export descendant cleanup",()=>{
 const file="apps/worker/src/export/deliver.ts",journal="journal.save(job);journal.started(lease,process);"
 expect(deploymentRuntimeHits(file,journal+"killExportDescendants(child.pid ?? 0)")).toContain("export-process-root: require a spawned child PID before scanning descendants")
 expect(deploymentRuntimeHits(file,journal+"const pid=child.pid;if(pid)killExportDescendants(pid)")).toEqual([])
})
