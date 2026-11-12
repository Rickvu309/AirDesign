# Connected agents

The account menu on Home has `Agents`, which opens `/settings/agents`. The page shows the signed-in person's connected MCP agents with a `Disconnect` button for each, and shows the server's own MCP address with a `Copy` button so the person can paste it into Claude, Claude Code, Codex, or another MCP client.

## Sub-features

- `agents-reach` the account menu on Home and the `Settings` link in the side navigation open `/settings/agents`. Signed-out visits go to sign-in with `next` set to the path and query.
- `agents-mcp` the `MCP server` card shows the server's `resource` address from `accountRoutes.agents` and copies it to the clipboard when `Copy` is clicked, switching the button label to `Done`.
- `agents-list` `accountRoutes.agents` returns only the signed-in person's exchanged, unrevoked grants, newest first, with `id`, `name`, `agent` (`claude`, `claude-code`, `codex`, or `other`), `host`, and `connected`. Unexchanged approvals, revoked grants, and another person's grants never appear.
- `agents-disconnect` clicking `Disconnect` opens `Disconnect <agent>?` (`Claude can no longer read or edit your decks. You can connect it again at any time.`). Confirming posts `accountRoutes.revokeAgent` with `{ id }`, removes the row, and refuses that grant's access token on `/mcp` (401 `invalid_token`) and refresh token on `/oauth/token` (400 `invalid_grant`) at once.
- `agents-session-only` both `accountRoutes.agents` and `accountRoutes.revokeAgent` accept only a browser session cookie; any `Authorization` header answers 401 `session` even alongside a valid cookie, and another account's or unknown grant id answers 403 `owner`.

## How to get to it (user POV)

- Sign in, open `/`, click the account button with the email in the side navigation, choose `Agents` (or click `Settings` in the side navigation).

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> connected-agents`. Prints `"passed":true`.
- **Open from Home.** Sign in, open `/`, open the account menu (`NN-account-menu`), click `menuitem "Agents"`. Lands on `/settings/agents` showing `Not connected` and the server's MCP address (`NN-agents-empty`).
- **Copy MCP address.** Click `button "Copy"`. Clipboard holds `mcp` from `accountRoutes.agents` and the button reads `Done` (`NN-mcp-copied`).
- **Connect an agent.** Register a Claude OAuth client (`oauthRoutes.register`), approve (`oauthRoutes.approve`), exchange the authorization code (`oauthRoutes.token`), and initialize `/mcp` with the issued bearer token. Reload `/settings/agents`: `Claude` and `Connected just now` appear (`NN-agents-connected`).
- **Disconnect.** Click `button "Disconnect"`, check the confirmation dialog (`NN-disconnect-confirm`), confirm `Disconnect`. `Claude` disappears and `Not connected` returns (`NN-agents-disconnected`).
- **Second views.** `post(accountRoutes.agents, {}, cookie)` returns `agents: []`, `/mcp` with the access token answers 401, and `/oauth/token` with the refresh token answers 400 `invalid_grant`.

## Gotchas

- Only grants whose authorization code has been exchanged (`code = 'used'`) and not revoked appear in `agents`. Approving on `/oauth/authorize` without completing token exchange leaves the grant `open` and unlisted.
- Static sample controls from the design screen (`Aira` switch, `Connect` buttons, `Setup guides for Claude and Codex`, and `Usage` / `Account` tabs) are intentionally absent on `/settings/agents` until their backend slices exist.
