export const sql = `
alter table session.oauth_grant add column rotates boolean not null default true;
`
