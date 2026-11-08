import {PGlite} from "@electric-sql/pglite"
import {expect,it} from "vitest"
import {createCatalog,initializeCatalog} from "../src/index.ts"
import {initialHistory} from "../../change-log/src/index.ts"
import {fixtureDeck,fixtureElement} from "../../deck/src/fixture.ts"
import {id} from "../../deck/src/index.ts"

it("searches owned visible deck text and notes without matching internal geometry, font or ids",async()=>{
  const database=new PGlite(),owner={personId:"owner"},deck=fixtureDeck(2)
  try{
    await database.query("CREATE TABLE editing_deck(id text PRIMARY KEY,owner text NOT NULL,state jsonb NOT NULL,deleted boolean NOT NULL DEFAULT false)")
    await database.query("CREATE TABLE account_deletion(owner text PRIMARY KEY,requested bigint NOT NULL,deadline bigint NOT NULL)")
    await database.query("CREATE TABLE account_deletion_receipt(id text PRIMARY KEY,completed bigint)")
    await initializeCatalog(database)
    const catalog=createCatalog(work=>database.transaction(work)),slide=deck.slides[0]!
    slide.notes="Market forecast"
    slide.elements=[{...fixtureElement(0),id:id("nested"),kind:"group",children:[fixtureElement(0)]},fixtureElement(1)]
    await database.query("INSERT INTO editing_deck(id,owner,state,title) VALUES($1,$2,$3,$4)",[deck.id,owner.personId,initialHistory(deck),"Board review"])
    for(const query of ["BOARD","clear direction","forecast",""])expect((await catalog.list(owner,false,query)).map(entry=>entry.id)).toEqual([deck.id])
    for(const query of ["geometry","rectangle","Geist","nested","%_"])expect(await catalog.list(owner,false,query)).toEqual([])
    slide.notes="Geometry review"
    await database.query("UPDATE editing_deck SET state=$1 WHERE id=$2",[initialHistory(deck),deck.id])
    expect((await catalog.list(owner,false,"geometry")).map(entry=>entry.id)).toEqual([deck.id])
    expect(await catalog.list({personId:"another"},false,"Board")).toEqual([])
    expect(await catalog.list(owner,true,"Board")).toEqual([])
  }finally{await database.close()}
})
