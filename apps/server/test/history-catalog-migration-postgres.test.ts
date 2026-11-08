import {randomBytes,createHash} from "node:crypto"
import pg from "pg"
import {expect,it} from "vitest"
import {createHistoryStore,historySchemaVersion,type HistoryStore} from "../src/db/history-store.ts"
import {fixtureDeck} from "../../../packages/deck/src/fixture.ts"
import {commandId} from "../../../packages/change-log/src/index.ts"

async function schemaFingerprint(sql:pg.Client){
  const columns=await sql.query("SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name")
  const indexes=await sql.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")
  const constraints=await sql.query("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname")
  return createHash("sha256").update(JSON.stringify([columns.rows,indexes.rows,constraints.rows])).digest("hex")
}

it("migrates the fingerprinted production v1 catalog without losing decks, history or stars and reopens idempotently",async()=>{
  const database=`airdesign_catalog_migration_${randomBytes(6).toString("hex")}`
  const host=process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock",user=process.env.AIRDESIGN_PG_USER ?? "quan"
  const admin=new pg.Client({host,user,database:"postgres"}),stores:HistoryStore[]=[]
  await admin.connect();await admin.query(`CREATE DATABASE ${database}`)
  const driver={kind:"postgres",url:`postgresql://${user}@/${database}?host=${host}`} as const
  const sql=new pg.Client({connectionString:driver.url});await sql.connect()
  try{
    const setup=await createHistoryStore(driver,()=>1234);stores.push(setup)
    const owner={personId:"retained-owner"},deck=fixtureDeck(2)
    await setup.create(owner,deck)
    await setup.commit(owner,deck.id,{id:commandId("retained-edit"),kind:"patch",run:null,base:0,target:deck.slides[0]!.id,fields:{notes:"Retain production notes 123"}})
    const retained=await setup.read(owner,deck.id)
    await setup.close()
    await sql.query("ALTER TABLE editing_deck DROP COLUMN starred, DROP COLUMN created_at")
    await sql.query("UPDATE schema_version SET version=1 WHERE name='history'")
    expect(await schemaFingerprint(sql)).toBe("c8d3c452904da12534bc2107eaf825a5df994e32757b9b046968ad349c283dbd")
    const before=await sql.query("SELECT * FROM editing_receipt ORDER BY deck,id")
    const migrated=await createHistoryStore(driver);stores.push(migrated)
    expect((await sql.query("SELECT version FROM schema_version WHERE name='history'")).rows).toEqual([{version:historySchemaVersion}])
    expect(await migrated.read(owner,deck.id)).toEqual(retained)
    expect(await migrated.catalog.details(owner,deck.id)).toMatchObject({starred:false,created:1234})
    await expect(migrated.catalog.details({personId:"other-owner"},deck.id)).rejects.toThrow("deck-not-found")
    await migrated.catalog.star(owner,deck.id,true)
    const after=await sql.query("SELECT * FROM editing_deck ORDER BY id"),fingerprint=await schemaFingerprint(sql)
    expect((await sql.query("SELECT * FROM editing_receipt ORDER BY deck,id")).rows).toEqual(before.rows)
    await migrated.close()
    const reopened=await createHistoryStore(driver);stores.push(reopened)
    expect(await reopened.read(owner,deck.id)).toEqual(retained)
    expect(await reopened.catalog.details(owner,deck.id)).toMatchObject({starred:true,created:1234})
    expect((await sql.query("SELECT * FROM editing_deck ORDER BY id")).rows).toEqual(after.rows)
    expect(await schemaFingerprint(sql)).toBe(fingerprint)
  }finally{
    await Promise.all(stores.map(store=>store.close()));await sql.end()
    await admin.query(`DROP DATABASE ${database}`);await admin.end()
  }
})
