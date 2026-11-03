_AirDesign / v0.1 / F09_

# F09 Settings and data

Profile, preferences, plan, connected agents, and their data. Everything the agents use is visible here.

## Flow

- **1 Open settings** (S12 Settings)
- **2 Profile** (S12 Settings)
- **3 Preferences** (S12 Settings)
- **Plan and usage** (F07, S11 Plan and usage)
- **4 Connected agents** (S08 Connected agents)
- **5 Data** (S12 Settings)
- **Access ends at once** (End a connection, or add one in F06)
- **Export or delete?**
- **Export all: private link by email**
- **Delete account: export offered first**
- **Confirmed?**
- **Account closed. Data gone in 30 days.**

Arrow labels: yes

## Steps and screens

| Failure | What is safe | Next step |
|---|---|---|
| 1 Open settings | S12 Settings /settings | Profile, Preferences, Plan and usage, Connected agents, Data. |
| 2 Profile | S12 Settings /settings/profile | Name, email, sign-in methods. A new email is confirmed at both the old and new address. Email sign-in cannot be removed. |
| 3 Preferences | S12 Settings /settings/preferences | Language, default brand, and notes for agents, such as always add speaker notes. Both agents read them with get_context. |
| Plan and usage | S11 Plan and usage /settings/plan | As in F07. |
| 4 Connected agents | S08 Connected agents /settings/agents | Each connection with its app, when it was approved and last used. Ending one stops its access at once. Adding one is F06. |
| 5 Data | S12 Settings /settings/data | Export all: every deck as PowerPoint plus AirDesign data, with their images and files, sent as a private link by email. Delete account: see the rules. |

New code in F09: S12 Settings. S08 and S11 are reused. Next free codes are S13 and X7.

## When something goes wrong

- Connection ended while its agent runs: the next call fails, the run stops, changes so far stay.
- Large data export: built in the background, emailed when ready. The link lasts 24 hours.
- Delete with Pro active: the plan ends at once and unused credits are lost. They are told first.
- New email already in use: refused.
- Signed up again after deleting: a fresh account, without starter credits.

## Rules

- Everything the agents use about the person is visible and editable here.
- Ending a connection stops its access at once.
- A data export holds everything they own and opens without AirDesign.
- Delete account: export offered, plan cancelled, sessions and connections ended at once, data removed within 30 days.
- Settings changes are free and take effect at once.
