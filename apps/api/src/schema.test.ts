import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { migrations, type Migration } from "./migrations.js"
import { startEmptyCluster, type EmptyCluster } from "./postgres-setup.js"
import { createRole } from "./provision.js"
import { applySchema } from "./schema.js"

let cluster: EmptyCluster
let db: Client

const first: Migration = migrations[0] ?? { id: 0, sql: "" }

const queued: Migration = {
  id: 2,
  sql: `
create table deck.queued (n integer primary key, taken timestamptz);
create table deck.blocked (n integer);
insert into deck.queued (n) select generate_series(1, 5);
insert into deck.blocked values (5);
create function deck.take(size integer) returns integer language plpgsql as $$
declare done integer;
begin
  update deck.queued set taken = now()
    where n in (select n from deck.queued where taken is null order by n limit size);
  get diagnostics done = row_count;
  if exists (select 1 from deck.queued join deck.blocked using (n) where taken is not null) then
    raise exception 'blocked';
  end if;
  return done;
end
$$;`,
  batch: "select deck.take(2) as done",
}

const taken = "select count(taken)::integer as taken, count(distinct taken)::integer as batches from deck.queued"

beforeAll(async () => {
  cluster = await startEmptyCluster()
  db = new Client({ connectionString: `postgres://postgres@127.0.0.1:${String(cluster.port)}/postgres` })
  await db.connect()
  for (const role of ["session", "deck", "listen"]) await createRole(db, role, "local-test")
})

afterAll(async () => {
  await db.end()
  await cluster.stop()
})

it("runs a migration's batch in transactions of its own until it does nothing, and finishes it on the next run", async () => {
  await expect(applySchema(db, [first, queued])).rejects.toThrow("blocked")
  const recorded = await db.query<{ id: number }>("select id from setup.migration order by id")
  expect(recorded.rows).toEqual([{ id: 1 }, { id: 2 }])
  expect((await db.query(taken)).rows).toEqual([{ taken: 4, batches: 2 }])
  await db.query("delete from deck.blocked")
  expect(await applySchema(db, [first, queued])).toEqual({ applied: 0, at: 2 })
  expect((await db.query(taken)).rows).toEqual([{ taken: 5, batches: 3 }])
})
