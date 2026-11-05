# F06 Connect Agent Flow

AirDesign / v0.1 / F06

F06 Connect a User Agent

Add AirDesign to the agent, sign in, approve. The agent gets its own access, and the person can end it any time.

Screen

Other flow or outside

Decision

no, then back

yes

deny

yes

S81.02 Settings, agents

1 Add AirDesign to the agent

The address and the steps for their app.

From F02, F03 or the agent guide

Or the agent calls first

X3 Your agent app

2 The agent asks to connect

It registers itself and sends the person to sign in.

Signed in?

F01

Sign in

S71 Approve agent

3 Approve access

Which agent, which account, what it can and cannot do.

Approved?

X3 Your agent app

Told no. Nothing granted.

X3 Your agent app

4 Connected

Its own access. The first call works.

F02, F03

Request goes on

What a connection allows

It can

Read and edit all of the person's decks. Use their brand and files. Import and export PowerPoint. See the selection in an open editor.

It cannot

Change billing, credits, usage resets or auto reset. Change the account or sign-in. Delete decks. See anyone else's decks. One scope for everyone in v0.1.

How access works

OAuth with PKCE, as the MCP spec sets out. Each connection has its own token, stored hashed. Short access, refresh that rotates. 30 days unused and it expires.

Steps and screens

Step

Screen

Route

What happens

Goes to

1 Add AirDesign to the agent

S81.02 Settings, agents

/settings/agents

Settings, Agents: Claude or Codex at launch, with the address and the steps. The same guide is on the site (F10).

2

Or the agent calls first

X3 Your agent app

outside

An agent that calls AirDesign without access is told to connect, and starts step 2 itself.

2

2 The agent asks to connect

X3 Your agent app

outside

The agent registers itself and sends the person to AirDesign in the browser.

3, or F01 first

3 Approve access

S71 Approve agent

/connect/approve

Shows the agent's logo and name, the account with Switch, what it will be able to do, and where it sends the person back. Claude returns to claude.ai, Codex to this computer. Allow or Cancel.

4, or stop

4 Connected

X3 Your agent app

outside

The agent gets its own access and its first call works. The connection is listed with when it was approved and last used.

F02 or F03

Screens: S71.01 approve Claude, S71.02 Claude connected, S71.03 approve Codex, S81.02 Settings, agents.

When something goes wrong

Denied

The agent is told no and gets nothing. It can ask again.

Wrong account

The approval names the account. Switching goes through F01 and comes back.

Approval left open

It expires after 10 minutes. The agent starts again.

Look-alike agent name

The name is the agent's own claim. Where it sends the person back is shown next to it.

Same app on two computers

Two connections, listed and ended separately.

Access ended mid-run

The next call fails, the run stops, changes so far stay.

App without OAuth

Not supported in v0.1. Connecting with a token comes later.

Rules

Nothing is granted without the person approving it.

Each connection has its own token. Tokens are stored hashed, never shown again, never logged.

Every change an agent makes is tagged with its connection.

Ending a connection stops its access at once (F09). Signing out ends browser sessions, not agent connections.

Connecting is free. A User Agent's work uses the person's weekly usage, plus rate limits per connection.

The same tools as Aira, through the same MCP adapter.

Target: connected in under 1 minute.
