# A throwaway Postgres cluster takes another port when the one it picked is taken before it binds

`apps/api/src/free-port.test.ts`. The kernel picks the port, so it never falls in the 4400 to 4999 band that browser runs start from. Another process can still take it between the pick and `pg_ctl start`, so `onFreePort` picks again, up to five times, when the server log says it could not bind. A refusal about anything else stops at once.
