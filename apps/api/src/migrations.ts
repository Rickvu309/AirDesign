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
  {
    id: 14,
    sql: `
create table deck.background_backup (
  id text not null references deck.saved (id) on delete cascade,
  revision integer not null,
  register jsonb not null,
  rewritten timestamptz not null default now(),
  primary key (id, revision)
);
create function deck.slide_backgrounds(register jsonb) returns jsonb
language plpgsql immutable as $$
declare
  command jsonb;
  edit jsonb;
  copied jsonb;
  slide text;
  node text;
  shown jsonb := '{}';
  opened jsonb := '{}';
  rows jsonb := '{}';
  added jsonb := '[]';
  kept jsonb := '[]';
  nodes jsonb := register->'nodes';
  elements jsonb := register->'elements';
begin
  for command in select value from jsonb_array_elements(register->'order') loop
    slide := command->>'id';
    if command->>'slide' = 'background' then
      node := slide || '.slide';
      edit := case when jsonb_typeof(command->'color') = 'null' then to_jsonb('opening'::text)
        else jsonb_build_object('set', jsonb_build_object('solid', command->'color')) end;
      shown := shown || jsonb_build_object(slide, edit);
      if not rows ? node then
        added := added || jsonb_build_array(node);
        rows := rows || jsonb_build_object(node, '[]'::jsonb);
      end if;
      rows := rows || jsonb_build_object(node, (rows->node) || jsonb_build_array(
        jsonb_build_object('actor', 'person', 'visible', true, 'v', 28,
          'patch', jsonb_build_object('fill', jsonb_build_object('value', edit)))
        || case when command ? 'runId' then jsonb_build_object('actor', 'agent', 'runId', command->'runId')
          else '{}'::jsonb end));
      continue;
    end if;
    if command->>'slide' = 'clone'
      and not coalesce(command->'floor', '[]') @> jsonb_build_array(jsonb_build_object('node', slide || '.slide')) then
      copied := case when jsonb_typeof(shown->(command->>'source')) = 'object'
        then shown->(command->>'source')->'set' else opened->(command->>'source') end;
      if copied is not null then
        opened := opened || jsonb_build_object(slide, copied);
        command := command || jsonb_build_object('floor', coalesce(command->'floor', '[]') || jsonb_build_array(
          jsonb_build_object('node', slide || '.slide', 'kind', 'slide', 'value', null, 'box', null,
            'grouped', false, 'opening', jsonb_build_object('fill', jsonb_build_object('value',
              jsonb_build_object('set', copied))))));
      end if;
    end if;
    kept := kept || jsonb_build_array(command);
  end loop;
  for node in select value from jsonb_array_elements_text(added) loop
    if elements ? node then
      elements := elements || jsonb_build_object(node,
        (elements->node) || jsonb_build_object('landed', (rows->node) || (elements->node->'landed')));
    else
      elements := elements || jsonb_build_object(node, jsonb_build_object('route', register->'route',
        'floor', '', 'landed', rows->node, 'phase', 'idle', 'runId', null, 'readAt', null,
        'guarded', false, 'claimed', null, 'stoppedAt', null, 'slides', 1, 'bytes', 0));
    end if;
    if not nodes @> jsonb_build_array(node) then
      nodes := nodes || jsonb_build_array(node);
    end if;
  end loop;
  return register || jsonb_build_object('order', kept, 'nodes', nodes, 'elements', elements);
end
$$;
create function deck.rewrite_backgrounds(size integer) returns integer
language plpgsql as $$
declare
  picked record;
  done integer := 0;
begin
  for picked in
    select id, revision, register from deck.saved
    where register->'order' @> '[{"slide": "background"}]'
    limit size
    for update skip locked
  loop
    insert into deck.background_backup (id, revision, register)
      values (picked.id, picked.revision, picked.register);
    update deck.saved set revision = picked.revision + 1, register = deck.slide_backgrounds(picked.register)
      where id = picked.id;
    perform pg_notify('deck', picked.id || ':' || (picked.revision + 1));
    done := done + 1;
  end loop;
  return done;
end
$$;
`,
  },
  {
    id: 15,
    sql: `
with rewritten as (
  update deck.saved set revision = revision + 1, register = deck.slide_backgrounds(register)
  where register->'order' @> '[{"slide": "background"}]'
  returning id, revision
)
select pg_notify('deck', id || ':' || revision) from rewritten;
drop function if exists deck.rewrite_backgrounds(integer);
drop function if exists deck.slide_backgrounds(jsonb);
drop table if exists deck.background_backup;
`,
  },
  {
    id: 16,
    sql: `
lock table session.aira_ask in access exclusive mode;
update session.aira_ask older set ask = null
from session.aira_ask newer
where older.email = newer.email and older.ask = newer.ask and older.id < newer.id;
alter table session.aira_ask add column followed boolean not null default true;
drop index session.aira_ask_email;
create unique index aira_ask_email on session.aira_ask (email, ask);
`,
  },
  {
    id: 17,
    sql: `
alter table session.account add column name text
  check (name is null or (length(name) <= 100 and name !~ '[[:cntrl:]]'));
update session.account set name = '';
`,
  },
  {
    id: 18,
    sql: `
create table session.credits (
  email text primary key references session.account(email) on delete cascade,
  cents integer not null default 0 check (cents >= 0),
  auto_reset boolean not null default false
);
create table session.credit_history (
  id bigint generated always as identity primary key,
  email text not null references session.account(email) on delete cascade,
  once text not null,
  at timestamptz not null,
  cents integer not null check (cents = -500),
  unique(email, once)
);
create index credit_history_account on session.credit_history(email, id desc);
grant select, insert, update on session.credits to session;
grant select, insert on session.credit_history to session;
grant usage, select on sequence session.credit_history_id_seq to session;
`,
  },
  {
    id: 19,
    sql: `
create table deck.scene (
  id text primary key,
  owner text not null references session.account (email) on delete cascade,
  name text not null default '',
  rev integer not null,
  fold jsonb not null,
  created timestamptz not null default now(),
  edited timestamptz not null default now()
);
create index scene_owner on deck.scene (owner);
create table deck.scene_edit (
  deck text not null references deck.scene (id) on delete cascade,
  rev integer not null,
  once text not null,
  edit jsonb not null,
  primary key (deck, rev),
  unique (deck, once)
);
grant select, insert, update on deck.scene to deck;
grant select, insert on deck.scene_edit to deck;
`,
  },
  {
    id: 20,
    sql: `
alter table deck.media drop constraint media_deck_fkey;
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
    where media.deck in (select id from deck.saved where owner = address union all select id from deck.scene where owner = address)
    on conflict (key) do nothing;
  delete from deck.media
    where deck in (select id from deck.saved where owner = address union all select id from deck.scene where owner = address);
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
    id: 21,
    sql: `
alter table deck.scene add column trashed timestamptz, add column starred boolean not null default false;
grant delete on deck.scene to deck;
`,
  },
  {
    id: 22,
    sql: `
create table deck.scene_node (
  deck text not null references deck.scene (id) on delete cascade,
  id text not null,
  type text not null,
  parent text,
  node jsonb not null,
  revs jsonb not null,
  primary key (deck, id)
);
create unique index scene_node_deck on deck.scene_node (deck) where type = 'deck';
create index scene_node_parent on deck.scene_node (deck, parent) where parent is not null;
grant select, insert, update on deck.scene_node to deck;
alter table deck.scene
  add column runs jsonb not null default '{}'::jsonb,
  add column elements integer not null default 0,
  add column slides integer not null default 0;
insert into deck.scene_node (deck, id, type, parent, node, revs)
select source.id, found.key, found.value ->> 'type', found.value -> 'parent' ->> 'id', found.value,
  coalesce(source.fold -> 'revs' -> found.key, '{}'::jsonb)
from deck.scene source, jsonb_each(source.fold -> 'nodes') as found;
update deck.scene set runs = coalesce(fold -> 'runs', '{}'::jsonb);
update deck.scene as target set
  elements = (select count(*) from deck.scene_node node where node.deck = target.id and node.parent is not null),
  slides = (
    select count(*) from deck.scene_node slide
    join deck.scene_node holder on holder.deck = slide.deck and holder.id = slide.parent
    where slide.deck = target.id and slide.type = 'slide'
      and holder.node -> 'parent' is distinct from 'null'::jsonb
      and coalesce((holder.node ->> 'hidden')::boolean, false) = false
  );
alter table deck.scene drop column fold;
`,
  },
  {
    id: 23,
    sql: `
alter table deck.scene_edit add column was jsonb;
create index scene_edit_run on deck.scene_edit (deck, (edit -> 'author' ->> 'run'), rev)
  where edit -> 'author' ->> 'run' is not null;
`,
  },
]
