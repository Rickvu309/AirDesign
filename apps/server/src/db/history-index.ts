import type { PGlite } from "@electric-sql/pglite"
import type { Command, Contribution, History } from "../../../../packages/change-log/src/index.ts"

type Transaction = Pick<PGlite, "query">
type Property = { node: string; key: string }

export async function initializeHistoryIndex(tx: Transaction) {
  await tx.query("CREATE TABLE IF NOT EXISTS editing_contribution (deck text NOT NULL REFERENCES editing_deck(id), id text NOT NULL, run text, payload jsonb NOT NULL, PRIMARY KEY(deck,id))")
  await tx.query("CREATE INDEX IF NOT EXISTS editing_contribution_run ON editing_contribution(deck,run)")
  await tx.query("CREATE INDEX IF NOT EXISTS editing_contribution_seq ON editing_contribution(deck,((payload->>'seq')::integer))")
  await tx.query("CREATE INDEX IF NOT EXISTS editing_contribution_toggled ON editing_contribution(deck,((payload->>'toggledAt')::integer))")
  await tx.query("CREATE TABLE IF NOT EXISTS editing_property (deck text NOT NULL REFERENCES editing_deck(id), event text NOT NULL, node text NOT NULL, key text NOT NULL, seq integer NOT NULL, active boolean NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(deck,event,node,key))")
  await tx.query("CREATE INDEX IF NOT EXISTS editing_property_active ON editing_property(deck,node,key,seq DESC) WHERE active")
  await tx.query("CREATE TABLE IF NOT EXISTS editing_key (deck text NOT NULL REFERENCES editing_deck(id), node text NOT NULL, key text NOT NULL, latest jsonb NOT NULL, person jsonb, PRIMARY KEY(deck,node,key))")
  await tx.query("CREATE TABLE IF NOT EXISTS editing_run (deck text NOT NULL REFERENCES editing_deck(id), id text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(deck,id))")
}

export async function loadHistoryIndex(tx: Transaction, deck: string, history: History, command: Command) {
  const heads = await tx.query<{node:string;key:string;latest:Pick<Contribution,"id">;person:Pick<Contribution,"id">|null}>("SELECT node,key,latest,person FROM editing_key WHERE deck=$1", [deck])
  const targets = command.kind === "undo-run"
    ? await tx.query<{ payload: Contribution }>("SELECT payload FROM editing_contribution WHERE deck=$1 AND run=$2", [deck,command.run])
    : command.kind === "undo" || command.kind === "redo"
      ? await tx.query<{ payload: Contribution }>("SELECT payload FROM editing_contribution WHERE deck=$1 AND id=$2", [deck,command.target])
      : { rows: [] }
  const excluded = targets.rows.map(row => row.payload.id)
  const active = command.kind === "undo" || command.kind === "redo" || command.kind === "undo-run"
    ? await tx.query<{node:string;key:string;id:string}>("SELECT k.node,k.key,p.event AS id FROM editing_key k CROSS JOIN LATERAL (SELECT event FROM editing_property p WHERE p.deck=k.deck AND p.node=k.node AND p.key=k.key AND p.active AND NOT (p.event=ANY($2::text[])) ORDER BY p.seq DESC LIMIT 1) p WHERE k.deck=$1", [deck,excluded])
    : { rows: [] }
  const references=[...active.rows,...heads.rows.flatMap(row=>(row.person ? [row.latest,row.person] : [row.latest]).map(event=>({node:row.node,key:row.key,id:event.id})))]
  const keysByEvent=new Map<string,Map<string,Set<string>>>()
  for(const reference of references){
    const nodes=keysByEvent.get(reference.id) ?? new Map<string,Set<string>>()
    const keys=nodes.get(reference.node) ?? new Set<string>()
    keys.add(reference.key);nodes.set(reference.node,keys);keysByEvent.set(reference.id,nodes)
  }
  const contributions=await tx.query<{payload:Contribution}>("SELECT payload FROM editing_contribution WHERE deck=$1 AND id=ANY($2::text[])",[deck,[...keysByEvent.keys()]])
  const reduced=contributions.rows.map(({payload:event})=>({...event,patches:event.patches.flatMap(patch=>{
    const keys=keysByEvent.get(event.id)?.get(patch.id)
    return keys ? [{...patch,keys:patch.keys.filter(key=>keys.has(key))}] : []
  })}))
  const targetIds = new Set(excluded)
  history.events = [...reduced.filter(event => !targetIds.has(event.id)), ...targets.rows.map(row => row.payload)].sort((a,b) => a.seq-b.seq)
  const targetRun = "run" in command ? command.run : targets.rows[0]?.payload.run
  if (targetRun !== undefined && targetRun !== null) {
    const runs = await tx.query<{ payload: History["runs"][number] }>("SELECT payload FROM editing_run WHERE deck=$1 AND id=$2", [deck,targetRun])
    history.runs = runs.rows.map(row => row.payload)
  }
}

function properties(event: Contribution): Property[] {
  return event.patches.flatMap(patch => patch.keys.map(key => ({node:patch.id,key})))
}

export async function saveHistoryIndex(tx: Transaction, deck: string, previous: History, next: History) {
  const changed = next.events.filter(event => {
    const old = previous.events.find(item => item.id === event.id)
    return !old || event.active !== old.active || event.toggledAt !== old.toggledAt
  })
  for (const event of changed) {
    const rows = JSON.stringify(properties(event))
    await tx.query("WITH contribution AS (INSERT INTO editing_contribution(deck,id,run,payload) VALUES ($1,$2,$5,$6) ON CONFLICT(deck,id) DO UPDATE SET payload=excluded.payload), properties AS (INSERT INTO editing_property(deck,event,node,key,seq,active,payload) SELECT $1,$2,p.node,p.key,$7,$3,$8::jsonb FROM jsonb_to_recordset($4::jsonb) AS p(node text,key text) ON CONFLICT(deck,event,node,key) DO UPDATE SET active=excluded.active,payload=excluded.payload RETURNING node,key,payload) INSERT INTO editing_key(deck,node,key,latest,person) SELECT $1,node,key,payload,CASE WHEN payload->>'actor'='person' THEN payload ELSE NULL END FROM properties ON CONFLICT(deck,node,key) DO UPDATE SET latest=excluded.latest,person=COALESCE(excluded.person,editing_key.person)", [deck,event.id,event.active,rows,event.run,JSON.stringify(event),event.seq,JSON.stringify({id:event.id,actor:event.actor})])
  }
  for (const run of next.runs) await tx.query("INSERT INTO editing_run(deck,id,payload) VALUES ($1,$2,$3) ON CONFLICT(deck,id) DO UPDATE SET payload=excluded.payload", [deck,run.id,JSON.stringify(run)])
}

export function currentProjection(history: History): History { return {...history,events:[],runs:[]} }
