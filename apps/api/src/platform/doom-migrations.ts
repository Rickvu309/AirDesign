import type { Migration } from "./migration.js"

export const doomMigrations: readonly Migration[] = [
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
  {
    id: 24,
    sql: `
alter table deck.scene rename to doom;
alter table deck.scene_edit rename to doom_edit;
alter table deck.scene_node rename to doom_node;
alter index deck.scene_owner rename to doom_owner;
alter index deck.scene_node_deck rename to doom_node_deck;
alter index deck.scene_node_parent rename to doom_node_parent;
alter index deck.scene_edit_run rename to doom_edit_run;
do $$
declare
  held record;
begin
  for held in
    select conrelid::regclass as owner, conname
    from pg_constraint
    where conrelid in ('deck.doom'::regclass, 'deck.doom_edit'::regclass, 'deck.doom_node'::regclass)
      and conname like 'scene%'
  loop
    execute format('alter table %s rename constraint %I to %I', held.owner, held.conname, 'doom' || substr(held.conname, 6));
  end loop;
end
$$;
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
    where media.deck in (select id from deck.saved where owner = address union all select id from deck.doom where owner = address)
    on conflict (key) do nothing;
  delete from deck.media
    where deck in (select id from deck.saved where owner = address union all select id from deck.doom where owner = address);
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
]
