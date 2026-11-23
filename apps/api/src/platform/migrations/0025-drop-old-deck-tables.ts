export const sql = `
insert into deck.original_delete (key, owner, expires)
  select original_key, owner, now() from deck.saved
  where original_key is not null
  on conflict (key) do nothing;
insert into deck.original_delete (key, owner, expires)
  select media.key, saved.owner, now() from deck.media join deck.saved on saved.id = media.deck
  on conflict (key) do nothing;
delete from deck.media where deck in (select id from deck.saved);
create or replace function session.delete_account(address text) returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(address, 0));
  perform email from session.account where email = address for update;
  insert into deck.original_delete (key, owner, expires)
    select media.key, address, now() + interval '15 minutes' from deck.media
    where media.deck in (select id from deck.doom where owner = address)
    on conflict (key) do nothing;
  delete from deck.media
    where deck in (select id from deck.doom where owner = address);
  delete from session.oauth_token where grant_id in (select id from session.oauth_grant where principal = address);
  delete from session.oauth_grant where principal = address;
  delete from session.access where email = address;
  delete from session.code where email = address;
  delete from session.sent where email = address;
  delete from session.aira_turn where email = address;
  delete from session.aira_ledger where email = address;
  delete from session.account where email = address;
end
$$;
drop table deck.once;
drop table deck.saved;
`
