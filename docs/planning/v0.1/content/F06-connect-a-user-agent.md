_AirDesign / v0.1 / F06_

# F06 Connect a User Agent

Add AirDesign to the agent, sign in, approve. The agent gets its own access, and the person can end it any time.

## Flow

- **1 Add AirDesign to the agent** (S08 Connected agents): The address and the steps for their app.
- **Or the agent calls first** (From F02, F03 or the agent guide)
- **2 The agent asks to connect** (X3 Your agent app): It registers itself and sends the person to sign in.
- **Signed in?**
- **Sign in** (F01)
- **3 Approve access** (S09 Approve agent): Which agent, which account, what it can and cannot do.
- **Approved?**
- **Told no. Nothing granted.** (X3 Your agent app)
- **4 Connected** (X3 Your agent app): Its own access. The first call works.
- **Request goes on** (F02, F03)

Arrow labels: no, then back; yes; deny; yes

## What a connection allows

- **It can**: Read and edit all of the person's decks. Read and add files. Import and export. See the selection in an open editor. Read the brand and preferences.
- **It cannot**: Change the plan or billing. Change the account or sign-in. Delete decks. See anyone else's decks. One scope for everyone in v0.1.
- **How access works**: OAuth with PKCE, as the MCP spec sets out. Each connection has its own token, stored hashed. Short access, refresh that rotates. 30 days unused and it expires.

## Steps and screens

| Step | Screen | Route | What happens | Goes to |
|---|---|---|---|---|
| 1 Add AirDesign to the agent | S08 Connected agents | /settings/agents | The person picks their agent app and gets the address and the steps for it. The same guide is on the site (F10). | 2 |
| Or the agent calls first | X3 Your agent app | outside | An agent that calls AirDesign without access is told to connect, and starts step 2 itself. | 2 |
| 2 The agent asks to connect | X3 Your agent app | outside | The agent registers itself and sends the person to AirDesign in the browser. | 3, or F01 first |
| 3 Approve access | S09 Approve agent | /connect/approve | Shows the agent name as it gave it, where it will send the person back, the account, and what it can and cannot do. The person approves or denies. | 4, or stop |
| 4 Connected | X3 Your agent app | outside | The agent gets its own access and its first call works. The connection is listed with when it was approved and last used. | F02 or F03 |

New codes in F06: S08 Connected agents, S09 Approve agent. Next free codes are S10 and X5.

## When something goes wrong

| Item | Detail |
|---|---|
| Denied | The agent is told no and gets nothing. It can ask again. |
| Wrong account | The approval names the account. Switching goes through F01 and comes back. |
| Approval left open | It expires after 10 minutes. The agent starts again. |
| Look-alike agent name | The name is the agent's own claim. Where it sends the person back is shown next to it. |
| Same app on two computers | Two connections, listed and ended separately. |
| Access ended mid-run | The next call fails, the run stops, changes so far stay. |
| App without OAuth | Not supported in v0.1. Connecting with a token comes later. |

## Rules

- Nothing is granted without the person approving it.
- Each connection has its own token. Tokens are stored hashed, never shown again, never logged.
- Every change an agent makes is tagged with its connection.
- Ending a connection stops its access at once (F09). Signing out everywhere ends browser sessions, not agent connections.
- Connecting is free. User Agents spend no credits, only rate limits per connection.
- The same tools as the AirDesign Agent, through the same MCP adapter.
- Target: connected in under 1 minute.
