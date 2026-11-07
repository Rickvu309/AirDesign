import {createHash,randomBytes} from "node:crypto"
import {openDatabase} from "./access-database.ts"
import {accessLinkPath} from "./access-link.ts"
import {issueIntent} from "./intent-token.ts"
import type {AccessDriver} from "./create-access.ts"

export async function createOperatorSmoke(options:{driver:AccessDriver;secret:string;publicOrigin:string;clock:()=>number}) {
  const allowlist=new Set((process.env.AIRDESIGN_SMOKE_EMAILS ?? "").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean))
  if(!allowlist.size)throw new Error("smoke-email-not-allowlisted")
  const origin=new URL(options.publicOrigin)
  const opened=await openDatabase(options.driver)
  return {
    async mintSmokeLink(address:string) {
      const email=address.trim().toLowerCase()
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!allowlist.has(email))throw new Error("smoke-email-not-allowlisted")
      const now=options.clock(),token=randomBytes(32).toString("base64url")
      const intent=issueIntent(options.secret,"home",now)
      const hash=(value:string)=>createHash("sha256").update(value).digest("hex")
      await opened.db.insert(opened.tables.challenge).values({id:randomBytes(16).toString("hex"),email,codeHash:hash(randomBytes(32).toString("hex")),linkHash:hash(token),intentToken:intent.token,expiresAt:new Date(now+120_000),attempts:0,locked:false,consumed:false})
      return new URL(accessLinkPath(token),origin).href
    },
    close:opened.close,
  }
}
