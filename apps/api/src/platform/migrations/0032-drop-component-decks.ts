export const sql = `
with component_deck as (
  delete from deck.doom d
  where exists (select 1 from deck.doom_node n where n.deck = d.id
                and (n.type = 'component' or n.node ? 'instance' or n.revs ? 'instance'))
     or exists (select 1 from deck.doom_edit e where e.deck = d.id
                and (e.edit @? 'strict $.writes[*] ? (@.prop == "instance" || (@.prop == "type" && @.value == "component"))'
                     or coalesce(e.replaced -> 'cells', e.replaced)
                       @? 'strict $[*] ? (@.key == "instance" || (@.key == "type" && @.value == "component"))'))
  returning id, owner
),
media_queued as (
  insert into deck.original_delete (key, owner, expires)
  select media.key, component_deck.owner, now() + interval '15 minutes'
  from deck.media join component_deck on media.deck = component_deck.id
  on conflict (key) do nothing
),
media_removed as (
  delete from deck.media using component_deck where deck.media.deck = component_deck.id
)
delete from session.agent_turn using component_deck where session.agent_turn.deck = component_deck.id;
`
