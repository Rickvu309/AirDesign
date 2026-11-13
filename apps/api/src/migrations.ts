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
  {
    id: 2,
    sql: `
alter table deck.saved
  add column original_key text,
  add column original_bytes integer,
  add column original_sha256 text,
  add column original_stored boolean not null default false,
  add column original_until timestamptz;
create table deck.original_delete (
  key text primary key,
  owner text not null,
  expires timestamptz not null default now(),
  attempted timestamptz not null default now()
);
create index original_delete_attempted on deck.original_delete (attempted, key);
grant select, insert, update, delete on deck.original_delete to deck;
`,
  },
  {
    id: 3,
    sql: `
alter table deck.saved
  add column deleted timestamptz,
  alter column register drop not null;
alter table deck.saved
  add constraint saved_live_register check (deleted is not null or register is not null),
  add constraint saved_deleted_empty check (
    deleted is null or (
      register is null and name = '' and trashed is null and original_key is null and original_bytes is null
      and original_sha256 is null and not original_stored and original_until is null
    )
  );
revoke delete on deck.saved from deck;
`,
  },
  {
    id: 4,
    sql: `
create table session.aira_ledger (
  email text primary key,
  spent bigint not null default 0,
  hold bigint not null default 0,
  turn text,
  week integer not null default 0,
  outside integer not null default 0,
  monday timestamptz not null
);
create table session.aira_turn (
  id text primary key,
  email text not null,
  outcome text not null check (outcome in ('open', 'settled', 'released', 'dropped')),
  input integer not null,
  ceiling bigint not null,
  charged bigint,
  request text,
  started timestamptz not null,
  ended timestamptz
);
create index aira_turn_email on session.aira_turn (email, started);
grant select, insert, update on session.aira_ledger, session.aira_turn to session;
`,
  },
  {
    id: 5,
    sql: `
alter table session.access add foreign key (email) references session.account (email) not valid;
alter table session.oauth_grant add foreign key (principal) references session.account (email) not valid;
alter table session.aira_ledger add foreign key (email) references session.account (email) not valid;
alter table session.aira_turn add foreign key (email) references session.account (email) not valid;
alter table deck.saved add foreign key (owner) references session.account (email) not valid;
create function session.delete_account(address text) returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(address, 0));
  perform email from session.account where email = address for update;
  insert into deck.original_delete (key, owner, expires)
    select original_key, owner, coalesce(original_until, now()) from deck.saved
    where owner = address and original_key is not null
    on conflict (key) do nothing;
  delete from session.oauth_token where grant_id in (select id from session.oauth_grant where principal = address);
  delete from session.oauth_grant where principal = address;
  delete from session.access where email = address;
  delete from session.code where email = address;
  delete from session.sent where email = address;
  delete from session.aira_turn where email = address;
  delete from session.aira_ledger where email = address;
  delete from deck.saved where owner = address;
  delete from session.account where email = address;
end
$$;
revoke all on function session.delete_account(text) from public;
grant execute on function session.delete_account(text) to session;
`,
  },
  {
    id: 6,
    sql: `
alter table session.oauth_grant add column connected timestamptz;
update session.oauth_grant
  set connected = to_timestamp((code_expires - 600000) / 1000.0)
  where code = 'used' and connected is null;
alter table session.oauth_grant
  add constraint oauth_grant_connected check (code = 'open' or connected is not null);
`,
  },
  {
    id: 7,
    sql: `
alter table deck.saved add column import_index jsonb;
alter table deck.saved add constraint saved_deleted_index_empty check (deleted is null or import_index is null);
`,
  },
  {
    id: 8,
    sql: `
create table session.caller_log (
  email text primary key references session.account (email) on delete cascade,
  events jsonb not null
);
create table session.agent_turn (
  email text not null references session.account (email) on delete cascade,
  deck text not null,
  run_id text,
  last_call bigint not null,
  revision integer not null,
  primary key (email, deck)
);
create table session.aira_ask (
  id bigint generated always as identity primary key,
  email text not null references session.account (email) on delete cascade,
  ask text,
  started timestamptz not null default now(),
  stopped timestamptz
);
create index aira_ask_email on session.aira_ask (email, ask);
grant select, insert, update, delete on session.caller_log, session.agent_turn, session.aira_ask to session;
`,
  },
  {
    id: 9,
    sql: `
create table deck.media (
  key text primary key,
  deck text not null references deck.saved (id) on delete cascade,
  sha256 text not null,
  bytes integer not null,
  unique (deck, sha256)
);
grant select, insert, delete on deck.media to deck;
create or replace function session.delete_account(address text) returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(address, 0));
  perform email from session.account where email = address for update;
  insert into deck.original_delete (key, owner, expires)
    select original_key, owner, coalesce(original_until, now()) from deck.saved
    where owner = address and original_key is not null
    on conflict (key) do nothing;
  insert into deck.original_delete (key, owner, expires)
    select media.key, address, now() + interval '15 minutes' from deck.media
    join deck.saved on saved.id = media.deck where saved.owner = address
    on conflict (key) do nothing;
  delete from session.oauth_token where grant_id in (select id from session.oauth_grant where principal = address);
  delete from session.oauth_grant where principal = address;
  delete from session.access where email = address;
  delete from session.code where email = address;
  delete from session.sent where email = address;
  delete from session.aira_turn where email = address;
  delete from session.aira_ledger where email = address;
  delete from deck.saved where owner = address;
  delete from session.account where email = address;
end
$$;
`,
  },
  {
    id: 10,
    sql: `
alter table session.account add column device text not null unique default replace(gen_random_uuid()::text, '-', '');
`,
  },
  {
    id: 11,
    sql: `
alter table deck.saved add column starred boolean not null default false;
`,
  },
  {
    id: 12,
    sql: `
alter table deck.once add column answer jsonb;
`,
  },
  {
    id: 13,
    sql: `
alter table session.agent_turn add column agent text not null default '';
alter table session.agent_turn drop constraint agent_turn_pkey;
alter table session.agent_turn add primary key (email, deck, agent);
`,
  },
]
