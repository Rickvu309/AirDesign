# Described words and the opening deck stay in memory when session storage is missing

`apps/web/src/lib/first-request.test.ts` keeps both when `sessionStorage` throws, and still reads a reload from storage. Node 24, which `package.json` and CI run, has no `sessionStorage`. A note kept only there is dropped, and `apps/web/src/decks/discard-opening.test.ts` then forgets the deck it should try again.
