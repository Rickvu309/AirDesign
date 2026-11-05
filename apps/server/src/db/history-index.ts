import type { PGlite } from "@electric-sql/pglite"
import type { Command, Contribution, History, Patch } from "../../../../packages/change-log/src/index.ts"

type Transaction = Pick<PGlite, "query">
type Property = { node: string; key: string; payload: Contribution; seq: number; actor: string }

export async function initializeHistoryIndex(tx: Transaction) {
  await tx.query("CREATE TABLE IF NOT EXISTS editing_contribution (deck text NOT NULL REFERENCES editing_deck(id), id text NOT NULL, run text, payload jsonb NOT NULL, PRIMARY KEY(deck,id))")
  await tx.query("CREATE INDEX IF NOT EXISTS editing_contribution_run ON editing_contribution(deck,run)")
  await tx.query("CREATE TABLE IF NOT EXISTS editing_property (deck text NOT NULL REFERENCES editing_deck(id), event text NOT NULL, node text NOT NULL, key text NOT NULL, seq integer NOT NULL, active boolean NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(deck,event,node,key))")
  await tx.query("CREATE INDEX IF NOT EXISTS editing_property_active ON editing_property(deck,node,key,seq DESC) WHERE active")
  await tx.query("CREATE TABLE IF NOT EXISTS editing_key (deck text NOT NULL REFERENCES editing_deck(id), node text NOT NULL, key text NOT NULL, latest jsonb NOT NULL, person jsonb, PRIMARY KEY(deck,node,key))")
  await tx.query("CREATE TABLE IF NOT EXISTS editing_run (deck text NOT NULL REFERENCES editing_deck(id), id text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(deck,id))")
}

function merge(events: Contribution[]): Contribution[] {
  const merged = new Map<string, Contribution>()
  for (const event of events) {
    const previous = merged.get(event.id)
    if (!previous) { merged.set(event.id, structuredClone(event)); continue }
    for (const patch of event.patches) {
      const old = previous.patches.find(p => p.id === patch.id)
      if (old) old.keys = [...new Set([...old.keys, ...patch.keys])]
      else previous.patches.push(structuredClone(patch))
    }
  }
  return [...merged.values()].sort((a,b) => a.seq - b.seq)
}

export async function loadHistoryIndex(tx: Transaction, deck: string, history: History, command: Command) {
  const heads = await tx.query<{ latest: Contribution; person: Contribution | null }>("SELECT latest,person FROM editing_key WHERE deck=$1", [deck])
  const targets = command.kind === "undo-run"
    ? await tx.query<{ payload: Contribution }>("SELECT payload FROM editing_contribution WHERE deck=$1 AND run=$2", [deck,command.run])
    : command.kind === "undo" || command.kind === "redo"
      ? await tx.query<{ payload: Contribution }>("SELECT payload FROM editing_contribution WHERE deck=$1 AND id=$2", [deck,command.target])
      : { rows: [] }
  const excluded = targets.rows.map(row => row.payload.id)
  const active = command.kind === "undo" || command.kind === "redo" || command.kind === "undo-run"
    ? await tx.query<{ payload: Contribution }>("SELECT p.payload FROM editing_key k CROSS JOIN LATERAL (SELECT payload FROM editing_property p WHERE p.deck=k.deck AND p.node=k.node AND p.key=k.key AND p.active AND NOT (p.event=ANY($2::text[])) ORDER BY p.seq DESC LIMIT 1) p WHERE k.deck=$1", [deck,excluded])
    : { rows: [] }
  const reduced = merge([...active.rows.map(row => row.payload), ...heads.rows.flatMap(row => row.person ? [row.latest,row.person] : [row.latest])])
  const targetIds = new Set(excluded)
  history.events = [...reduced.filter(event => !targetIds.has(event.id)), ...targets.rows.map(row => row.payload)].sort((a,b) => a.seq-b.seq)
  const targetRun = "run" in command ? command.run : targets.rows[0]?.payload.run
  if (targetRun !== undefined && targetRun !== null) {
    const runs = await tx.query<{ payload: History["runs"][number] }>("SELECT payload FROM editing_run WHERE deck=$1 AND id=$2", [deck,targetRun])
    history.runs = runs.rows.map(row => row.payload)
  }
}

function properties(event: Contribution): Property[] {
  return event.patches.flatMap(patch => patch.keys.map(key => ({node:patch.id,key,seq:event.seq,actor:event.actor,payload:{...event,patches:[{...patch,keys:[key]} satisfies Patch]}})))
}

export async function saveHistoryIndex(tx: Transaction, deck: string, previous: History, next: History) {
  const changed = next.events.filter(event => {
    const old = previous.events.find(item => item.id === event.id)
    return !old || event.active !== old.active || event.toggledAt !== old.toggledAt
  })
  for (const event of changed) {
    await tx.query("INSERT INTO editing_contribution(deck,id,run,payload) VALUES ($1,$2,$3,$4) ON CONFLICT(deck,id) DO UPDATE SET payload=excluded.payload", [deck,event.id,event.run,JSON.stringify(event)])
    const rows = JSON.stringify(properties(event))
    await tx.query("INSERT INTO editing_property(deck,event,node,key,seq,active,payload) SELECT $1,$2,p.node,p.key,p.seq,$3,p.payload FROM jsonb_to_recordset($4::jsonb) AS p(node text,key text,seq integer,payload jsonb) ON CONFLICT(deck,event,node,key) DO UPDATE SET active=excluded.active,payload=excluded.payload", [deck,event.id,event.active,rows])
    await tx.query("INSERT INTO editing_key(deck,node,key,latest,person) SELECT $1,p.node,p.key,p.payload,CASE WHEN p.actor='person' THEN p.payload ELSE NULL END FROM jsonb_to_recordset($2::jsonb) AS p(node text,key text,payload jsonb,actor text) ON CONFLICT(deck,node,key) DO UPDATE SET latest=excluded.latest,person=COALESCE(excluded.person,editing_key.person)", [deck,rows])
  }
  for (const run of next.runs) await tx.query("INSERT INTO editing_run(deck,id,payload) VALUES ($1,$2,$3) ON CONFLICT(deck,id) DO UPDATE SET payload=excluded.payload", [deck,run.id,JSON.stringify(run)])
}

export function currentProjection(history: History): History { return {...history,events:[],runs:[]} }
