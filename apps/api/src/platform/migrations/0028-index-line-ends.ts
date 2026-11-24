export const sql = `
create index doom_node_start on deck.doom_node (deck, (node #>> '{geometry,start,node}'))
  where node #>> '{geometry,start,node}' is not null;
create index doom_node_end on deck.doom_node (deck, (node #>> '{geometry,end,node}'))
  where node #>> '{geometry,end,node}' is not null;
`
