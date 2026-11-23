# Connected agents

The account menu (on Home, Trash and every Settings page) has `Agents`, which opens `/settings/agents`, the second tab of Settings, between `Usage` and `Account`. The side navigation's `Bring your own agent` card links there too (`Connect an agent`). The page shows the signed-in person's connected MCP agents with a `Disconnect` button for each, and shows the server's own MCP address with a `Copy` button so the person can paste it into Claude, Claude Code, Codex, or another MCP client.

## Sub-features

- `agents-reach` the account menu's `Agents` opens `/settings/agents`. The `Settings` link in the side navigation opens `/settings/usage` with a full page load; from there the `Agents` tab (`navigation "Settings"`) opens it. Signed out, the first call answers 401 `session` and the page then goes to sign-in with `next` set to the path and query.
- `agents-loading` while the list loads there is no loading text: the Agents card is empty, the MCP address is blank and `Copy` is disabled. A failed load shows the alert `Unable to load your agents. Check your connection and try again.` with `Try again`; a failed disconnect shows `Unable to disconnect. Check your connection and try again.` in the dialog. The list refreshes on window focus. With no agents, the page explains how to connect Claude or Codex; the sidebar hides its link back to this page.
- `agents-mcp` the `MCP server` card shows the server's `resource` address from `accountRoutes.agents` and copies it to the clipboard when `Copy` is clicked, switching the button label to `Done`. If clipboard access fails, the button reads `Unable to copy`, the address is selected and a status explains how to copy it manually.
- `agents-list` `accountRoutes.agents` returns only the signed-in person's exchanged, unrevoked grants, newest first, with `id`, `name`, `agent` (`claude`, `claude-code`, `codex`, or `other`), `host`, and `connected`. Unexchanged approvals, revoked grants, and another person's grants never appear.
- `agents-disconnect` clicking `Disconnect` opens `Disconnect <agent>?` (`Claude can no longer read or edit your decks. You can connect it again at any time.`). Confirming posts `accountRoutes.revokeAgent` with `{ id }`, removes the row, and refuses that grant's access token on `/mcp` (401 `invalid_token`) and refresh token on `/oauth/token` (400 `invalid_grant`) at once.
- `agents-calls` a connected agent calls the same `/mcp` tools as Aira, with the same limits, and each agent's `airdesign_edit_deck` without a `runId` starts its own run. See `aira-turn.md`.
- `agents-session-only` both `accountRoutes.agents` and `accountRoutes.revokeAgent` accept only a browser session cookie; any `Authorization` header answers 401 `session` even alongside a valid cookie, and another account's or unknown grant id answers 403 `owner`.

## How to get to it (user POV)

- Sign in, open `/`, click the account button with the email in the side navigation, choose `Agents`.
- Or click `Settings` in the side navigation, then the `Agents` tab.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> connected-agents`. Prints `"passed":true`.
- **Open from Home.** Sign in, open `/`, open the account menu (`NN-account-menu`), click `menuitem "Agents"`. Lands on `/settings/agents` showing `No agents connected yet` and the server's MCP address (`NN-agents-empty`).
- **Copy MCP address.** Click `button "Copy"`. Clipboard holds `mcp` from `accountRoutes.agents` and the button reads `Done` (`NN-mcp-copied`).
- **Connect an agent.** Register a Claude OAuth client (`oauthRoutes.register`), approve (`oauthRoutes.approve`), exchange the authorization code (`oauthRoutes.token`), and initialize `/mcp` with the issued bearer token. Reload `/settings/agents`: `Claude` and `Connected just now` appear (`NN-agents-connected`).
- **Disconnect.** Click `button "Disconnect"`, check the confirmation dialog (`NN-disconnect-confirm`), confirm `Disconnect`. `Claude` disappears and `No agents connected yet` returns (`NN-agents-disconnected`).
- **Second views.** `post(accountRoutes.agents, {}, cookie)` returns `agents: []`, `/mcp` with the access token answers 401, and `/oauth/token` with the refresh token answers 400 `invalid_grant`.

## Gotchas

- Only grants whose authorization code has been exchanged (`code = 'used'`) and not revoked appear in `agents`. Approving on `/oauth/authorize` without completing token exchange leaves the grant `open` and unlisted.
- Static sample controls from the design screen (`Aira` switch, `Connect` buttons, `Setup guides for Claude and Codex`) are absent on `/settings/agents` until their backend slices exist. The `Usage` and `Account` tabs are live; see `usage-page.md` and `delete-account.md`.
- Row names: `Claude Code` for claude-code; for `other`, the client name, or its host when it has none. Claude Code and Codex count only with loopback redirect addresses.
