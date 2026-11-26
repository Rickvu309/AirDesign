# Connected agents

The account menu (on Home, Trash and every Settings page) has `Agents`, which opens `/settings/agents`, the second tab of Settings, between `Usage` and `Account`. The page lists the signed-in person's connected MCP agents by name, with a `Disconnect` button for each, and a `Connect an agent` button. That button, and the one on the side navigation's `Bring your own agent` card, open the connect dialog on the page the person is on. The dialog offers Claude, ChatGPT, Gemini and Other: an app gets the server's MCP address with a `Copy` button and a link to its own connectors page, and a coding agent (Claude Code, Codex, Antigravity) gets one prompt to paste. While it is open it asks for the agent list every two seconds, and says `<agent> is connected` when a new one appears.

## Sub-features

- `agents-reach` the account menu's `Agents` opens `/settings/agents`. The `Settings` link in the side navigation opens `/settings/usage` with a full page load; from there the `Agents` tab (`navigation "Settings"`) opens it. Signed out, the first call answers 401 `session` and the page then goes to sign-in with `next` set to the path and query.
- `agents-loading` while the list loads there is no loading text: the Agents card shows its title and `Connect an agent` and no rows. A failed load shows the alert `Unable to load your agents. Check your connection and try again.` with `Try again`; a failed disconnect shows `Unable to disconnect. Check your connection and try again.` in the dialog. The list refreshes on window focus and when the connect dialog closes. With no agents, the page shows the agent marks, `No agents connected yet` and `Connect an agent`. On this tab the sidebar hides its card.
- `agents-mcp` the connect dialog shows the server's `resource` address from `accountRoutes.agents` (Claude app, ChatGPT app, Gemini app and Other) or a prompt that holds it (the coding agents), and copies it to the clipboard when `Copy` or `Copy prompt` is clicked, switching the button label to `Done`. If clipboard access fails, the button reads `Unable to copy`, the text is selected and a status explains how to copy it manually. If the address cannot load, the dialog says so with `Try again`.
- `agents-connect` with the dialog open, a grant that appears in `accountRoutes.agents` turns it into `<agent> is connected` with one button, `Done`. `Done` closes it and the list shows the agent.
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
- **Check slide advice.** Run `$V journey <run> consulting-mcp`. Build five slides with topic titles and unsourced charts, check the findings in the edit and each slide read, then fix the deck in one edit and read back the saved titles and sources.
- **Open from Home.** Sign in, open `/`, open the account menu (`NN-account-menu`), click `menuitem "Agents"`. Lands on `/settings/agents` showing `No agents connected yet` (`NN-agents-empty`).
- **Copy MCP address.** Click `button "Connect an agent"` (`NN-agents-connect`), then `button "Copy"` in the dialog. Clipboard holds `mcp` from `accountRoutes.agents` and the button reads `Done` (`NN-mcp-copied`).
- **Connect an agent.** With the dialog open, register a Claude OAuth client (`oauthRoutes.register`), approve (`oauthRoutes.approve`), exchange the authorization code (`oauthRoutes.token`), and initialize `/mcp` with the issued bearer token. The dialog reads `Claude is connected` with no reload (`NN-agents-connect-done`). `Done` closes it and `Claude` is in the list (`NN-agents-connected`).
- **Disconnect.** Click `button "Disconnect"`, check the confirmation dialog (`NN-disconnect-confirm`), confirm `Disconnect`. `Claude` disappears and `No agents connected yet` returns (`NN-agents-disconnected`).
- **Second views.** `post(accountRoutes.agents, {}, cookie)` returns `agents: []`, `/mcp` with the access token answers 401, and `/oauth/token` with the refresh token answers 400 `invalid_grant`.

## Gotchas

- Only grants whose authorization code has been exchanged (`code = 'used'`) and not revoked appear in `agents`. Approving on `/oauth/authorize` without completing token exchange leaves the grant `open` and unlisted.
- The `Usage` and `Account` tabs are live; see `usage-page.md` and `delete-account.md`.
- The server names only Claude, Claude Code and Codex. ChatGPT, Gemini and Antigravity connect as `other` and show under their client name with the plug mark.
- Row names: `Claude Code` for claude-code; for `other`, the client name, or its host when it has none. Claude Code and Codex count only with loopback redirect addresses.
