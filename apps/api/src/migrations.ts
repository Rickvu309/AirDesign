export type Migration = { readonly id: number; readonly sql: string }

export const migrations: readonly Migration[] = [
  {
    id: 1,
    sql: `
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
  code text not null,
  token text not null,
  issued timestamptz not null,
  delivered boolean not null default false
);
create table session.oauth_client (
  id text primary key,
  name text,
  redirect_uris text[] not null
);
create table session.oauth_grant (
  id text primary key,
  principal text not null,
  code text not null check (code in ('open', 'used')),
  generation integer not null,
  revoked boolean not null,
  client_id text not null references session.oauth_client (id),
  redirect_uri text not null,
  challenge text not null,
  code_hash text not null unique,
  code_expires double precision not null
);
create table session.oauth_token (
  hash text primary key,
  grant_id text not null references session.oauth_grant (id),
  generation integer not null,
  kind text not null check (kind in ('access', 'refresh')),
  expires double precision
);
create table deck.saved (
  id text primary key,
  revision integer not null,
  register jsonb not null,
  owner text not null,
  name text not null default '',
  created timestamptz not null default now(),
  edited timestamptz not null default now(),
  trashed timestamptz
);
create table deck.once (
  email text not null,
  deck text not null references deck.saved (id) on delete cascade,
  once text not null,
  revision integer not null,
  notify text not null,
  primary key (email, deck, once)
);
grant usage on schema session to session;
grant select, insert, update, delete on session.account, session.code, session.access, session.sent to session;
grant usage, select on all sequences in schema session to session;
grant select, insert, update on session.oauth_client, session.oauth_grant, session.oauth_token to session;
grant usage on schema deck to deck;
grant select, insert, update, delete on deck.saved to deck;
grant select, insert, update, delete on deck.once to deck;
grant usage on schema deck to listen;
grant select on deck.saved to listen;
`,
  },
]
