# A migration number is used once

the `migration-numbers` step of `pnpm check` compares the record with `origin/main` and names the next free number. It warns for now and blocks nothing; `pnpm land` stops on it
