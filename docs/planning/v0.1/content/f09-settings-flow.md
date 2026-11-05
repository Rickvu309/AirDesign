# F09 Settings Flow

AirDesign / v0.1 / F09

F09 Settings

Usage, Agents, Account. Everything the agents use is visible here.

yes

S81 Settings

1 Open settings

S81 Settings

2 Profile

S81.03 Settings, account

3 Preferences

F07, S81 Settings, usage

Usage

S81.02 Settings, agents

4 Connected agents

S81 Settings

5 Data

End a connection, or add one in F06

Access ends at once

Export or delete?

No data export in v0.1

Delete account: confirm

Confirmed?

Account closed. Data gone in 30 days.

Steps and screens

1 Open settings

S81 Settings /settings

Three tabs: Usage, Agents, Account. Opens on Usage.

2 Profile

S81.03 Settings, account /settings/account

Account tab: name and email. A new email is confirmed at both the old and new address.

3 Preferences

S81.03 Settings, account /settings/account

Account tab: language and slide size for new decks. Both agents read them with get_context.

Usage

S81 Settings, usage /settings/usage

As in F07.

4 Connected agents

S81.02 Settings, agents /settings/agents

Each connection with its app, when it was approved and last used. Ending one stops its access at once. Adding one is F06.

5 Data

Not in v0.1

Not in v0.1. Each deck exports on its own (F04).

Screens: S81.01 usage, S81.02 agents, S81.03 account. Not designed yet: connection details, email change, delete account confirm.

When something goes wrong

Connection ended while its agent runs: the next call fails, the run stops, changes so far stay.
Settings stay small in v0.1: Usage, Agents, Account.
Delete with credits left: unused credits are lost. They are told first.
New email already in use: refused.
Signed up again after deleting: a fresh account, without a fresh free week.

Rules

Everything the agents use about the person is visible and editable here.
Ending a connection stops its access at once.
Kept simple in v0.1: no data export, no agent notes.
Delete account: confirmed, sessions and connections ended at once, data removed within 30 days.
Settings changes are free and take effect at once.
