export const sql = `
create table deck.doom_agent_read (
  deck text not null references deck.doom(id) on delete cascade,
  agent text not null,
  rev integer not null,
  primary key (deck, agent)
);
grant select, insert, update on deck.doom_agent_read to deck;
`
