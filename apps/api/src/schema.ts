import type { Sql } from "./pool.js"

export const schemaSql = `
create schema session;
create schema deck;
revoke all on schema session from public;
revoke all on schema deck from public;
create table session.account (
  email text primary key
);
create table session.code (
  email text primary key,
  code text not null,
  token text not null unique,
  issued timestamptz not null,
  misses integer not null
);
create table session.access (
  token text primary key,
  email text not null,
  issued timestamptz not null
);
create table session.sent (
  id bigint generated always as identity primary key,
  email text not null,
  issued timestamptz not null
);
create table deck.saved (
  id text primary key,
  revision integer not null,
  register jsonb not null,
  owner text not null
);
create table deck.once (
  email text not null,
  deck text not null,
  once text not null,
  revision integer not null,
  notify text not null,
  primary key (email, deck, once)
);
grant usage on schema session to session;
grant select, insert, update, delete on session.account, session.code, session.access, session.sent to session;
grant usage, select on all sequences in schema session to session;
grant usage on schema deck to deck;
grant select, insert, update, delete on deck.saved to deck;
grant select, insert, update, delete on deck.once to deck;
grant usage on schema deck to listen;
grant select on deck.saved to listen;
`

export async function applySchema(db: Sql): Promise<void> {
  await db.query(schemaSql)
}
