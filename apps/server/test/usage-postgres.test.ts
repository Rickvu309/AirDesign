import {it,expect} from "vitest"
import {randomBytes} from "node:crypto"
import pg from "pg"
import {createHistoryStore} from "../src/db/history-store.ts"
it("serializes admissions and reset receipts across independent PostgreSQL pools",async()=>{
  const database=`airdesign_p07_${randomBytes(6).toString("hex")}`
  const host=process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock",user=process.env.AIRDESIGN_PG_USER ?? "quan"
  const admin=new pg.Client({host,user,database:"postgres"})
  await admin.connect()
  await admin.query(`CREATE DATABASE ${database}`)
  const driver={kind:"postgres",url:`postgresql://${user}@/${database}?host=${host}`} as const
  const first=await createHistoryStore(driver),second=await createHistoryStore(driver)
  try {
    await first.usage.reserve("owner",{id:"fill",actor:"user-agent",request:"fill",units:9999})
    const input={id:"same",actor:"user-agent" as const,request:"saved",units:1}
    const race=await Promise.all([first.usage.reserve("owner",input),second.usage.reserve("owner",input)])
    expect(race.map(value=>value.kind)).toEqual(["admitted","admitted"])
    expect((await second.usage.status("owner")).used).toBe(10000)
    const blocked=await first.usage.reserve("owner",{...input,id:"waiting"})
    if(blocked.kind!=="out-of-usage")throw new Error("expected-limit")
    await first.usage.grantFixture("owner","credit",1000,"bonus")
    const resets=await Promise.all([first.usage.reset("owner",blocked.limitHit),second.usage.reset("owner",blocked.limitHit)])
    expect(resets[0]).toEqual(resets[1])
    expect(resets[0]).toMatchObject({used:0,bonus:500,cycle:1})
    const direct=new pg.Client({host,user,database});await direct.connect()
    try{await expect(direct.query("UPDATE usage_event SET kind=kind WHERE owner='owner'")).rejects.toThrow("usage-events-are-append-only");await expect(direct.query("DELETE FROM usage_event WHERE owner='owner'")).rejects.toThrow("usage-events-are-append-only");await expect(direct.query("TRUNCATE usage_event")).rejects.toThrow("usage-events-are-append-only")}finally{await direct.end()}
  } finally {
    await first.close();await second.close()
    await admin.query(`DROP DATABASE ${database}`);await admin.end()
  }
})
