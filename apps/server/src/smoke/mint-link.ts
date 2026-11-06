import {createAccess,createMemoryInbox} from "../../../../packages/access/src/index.ts"

const email=process.argv[2],url=process.env.AIRDESIGN_DATABASE_URL ?? process.env.DATABASE_URL
const secret=process.env.AIRDESIGN_SECRET,origin=process.env.AIRDESIGN_PUBLIC_ORIGIN
const allowlist=(process.env.AIRDESIGN_SMOKE_EMAILS ?? "").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean)
if(!email || !allowlist.includes(email.trim().toLowerCase())) throw new Error("smoke-email-not-allowlisted")
if(!url || !secret || secret.length<32 || !origin) throw new Error("smoke-environment-missing")
const access=await createAccess({driver:{kind:"postgres",url},secret,publicOrigin:origin,mail:createMemoryInbox(),clock:Date.now,guard:{allow:()=>true},exposeInbox:false})
try {process.stdout.write(await access.mintSmokeLink(email,allowlist)+"\n")} finally {await access.close()}
