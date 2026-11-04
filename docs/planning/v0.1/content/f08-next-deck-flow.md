# F08 Next Deck Flow

AirDesign / v0.1 / F08

F08 Next deck

A returning person starts their next deck in their own style. The agent uses only what the person can see.

yes

no: AirDesign default

F01

Only if signed out

S31 Home

1 Come back

S31 Home

2 Start the next deck

Default template?

F11

Make one later

S40 Editor

3 The agent builds in their style

F03

Edit and refine

F04

Export to PowerPoint

Steps and screens

1 Come back

S31 Home /home

Signed in for 30 days, else F01 first. Their decks, last edited first, and their default template. Goes to 2.

2 Start the next deck

S31 Home /home

Describe it as in F02, point at decks to follow, or start from a copy (F14). Their own agent can do the same with list_decks and create_deck. Goes to 3.

3 The agent builds in their style

S40 Editor /d/:id

The deck starts with the default template. The agent reads the template, the decks pointed at, and the preferences, then works freely as in F02. Goes to F03 or F04.

Screens: S31.01 to S31.05 Home and decks, S40 Editor.

When something goes wrong

No default template: Basic. They can save one later (F11).

Rules

New decks start with the default template. Imported decks keep their own look (F05).
No hidden memory. The agent uses the template, the decks pointed at and the preferences, all visible to the person.
