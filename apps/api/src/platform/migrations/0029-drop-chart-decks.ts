export const sql = `
with chart_deck as (
  delete from deck.doom d
  where exists (select 1 from deck.doom_node n where n.deck = d.id and (n.node ? 'chart' or n.revs ? 'chart'))
     or exists (select 1 from deck.doom_edit e where e.deck = d.id
                and (e.edit @? 'strict $.** ? (@.prop == "chart")'
                     or coalesce(e.replaced, 'null'::jsonb) @? 'strict $.** ? (@.key == "chart")'))
  returning id, owner
),
media_queued as (
  insert into deck.original_delete (key, owner, expires)
  select media.key, chart_deck.owner, now() + interval '15 minutes'
  from deck.media join chart_deck on media.deck = chart_deck.id
  on conflict (key) do nothing
),
media_removed as (
  delete from deck.media using chart_deck where deck.media.deck = chart_deck.id
)
delete from session.agent_turn using chart_deck where session.agent_turn.deck = chart_deck.id;
`
