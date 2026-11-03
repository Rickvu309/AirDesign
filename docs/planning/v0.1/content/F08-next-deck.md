_AirDesign / v0.1 / F08_

# F08 Next deck

A returning person starts their next deck in their own style. The agent uses only what the person can see.

## Flow

- **Only if signed out** (F01)
- **1 Come back** (S04 Home)
- **2 Start the next deck** (S04 Home)
- **Default brand?**
- **Make one later** (F11)
- **3 The agent builds in their style** (S05 Editor)
- **Edit and refine** (F03)
- **Export to PowerPoint** (F04)

Arrow labels: yes; no: AirDesign default

## Steps and screens

| Failure | What is safe | Next step |
|---|---|---|
| 1 Come back | S04 Home /home | Signed in for 30 days, else F01 first. Their decks, last opened first, and their default brand. Goes to 2. |
| 2 Start the next deck | S04 Home /home | Describe it as in F02, point at decks to follow, or start from a copy (F14). Their own agent can do the same with list_decks and create_deck. Goes to 3. |
| 3 The agent builds in their style | S05 Editor /d/:id | The deck starts with the default brand. The agent reads the brand, the decks pointed at, and the preferences, then works freely as in F02. Goes to F03 or F04. |

No new codes in F08. Next free codes are S12 and X7.

## When something goes wrong

- No default brand: the AirDesign default. They can make one later (F11).
- Brand changed since the last deck: new decks use the latest version.
- Deck pointed at is very large: the agent reads its outline and the slides it needs.
- Deck pointed at was deleted: they are told, and the deck starts without it.
- Signed out on a new device: F01, then back here with the intent kept.

## Rules

- New decks start with the default brand. Imported decks keep their own look (F05).
- No hidden memory. The agent uses the brand, the decks pointed at and the preferences, all visible to the person.
- Decks pointed at are read, never changed.
- Credits work as in F02. User Agents spend none.
- Target: a returning person has a deck started within 10 s of arriving.
