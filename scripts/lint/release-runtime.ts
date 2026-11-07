export function releaseRuntimeHits(file:string,source:string):string[]{
  const name=file.replaceAll("\\","/")
  if(name.endsWith("/package.json")||name==="package.json"){
    const manifest=JSON.parse(source)
    if(manifest.name==="airdesign"&&!manifest.scripts?.build?.includes("build:export-renderer"))return ["worker-renderer-build: include build:export-renderer in the standard build"]
  }
  if(name.endsWith("apps/server/src/main.ts")&&/localPaymentProvider|AIRDESIGN_PAYMENT_FIXTURE_SECRET/.test(source))return ["payment-fixture-in-normal-start: inject test providers explicitly"]
  if(name.endsWith("apps/server/src/billing/reconcile.ts")&&/\?\?\s*["']dev-only-local-payment-fixture["']/.test(source))return ["payment-fixture-default-secret: require explicit fixture credentials"]
  if(name.endsWith("apps/worker/src/main.ts")&&!source.includes("await runWorkerCycle("))return ["worker-cycle-startup: enter the shared worker cycle"]
  if(name.endsWith("apps/worker/src/worker-cycle.ts")&&(!source.includes('access(new URL("../dist/render.js",import.meta.url))')||source.indexOf('access(new URL(')>source.indexOf("new OperationStore(")))return ["worker-renderer-startup: validate the built renderer before opening queues"]
  return []
}
