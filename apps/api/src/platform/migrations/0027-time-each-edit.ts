export const sql = `
alter table deck.doom_edit add column landed timestamptz not null default now();
`
