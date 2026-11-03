_AirDesign / v0.1 / F11_

# F11 Brand and themes

Pick a curated theme, or build their own brand. A look changes only what is linked to it, in one undoable step.

## Flow

- **1 Choose a look** (S05 Editor): A curated theme, one of their brands, or a new one.
- **New brand?**
- **Save its look as my brand** (F05)
- **2 Build a brand** (S10 Brand): By hand, from a PowerPoint, or with an agent.
- **3 Check it** (S10 Brand): Sample slides and checks. They inform, never block.
- **4 Use it** (S05 Editor): Apply to this deck, make it the default, or both.
- **Fine-tune with an agent** (F03)
- **Next deck starts with it** (F08)

Arrow labels: no: a theme or one of their brands; yes

## Theme, brand, and how a look applies

- **Theme**: Curated by AirDesign and free. Colors, fonts and layouts anyone can start from. Ships with the product.
- **Brand**: The person's own: colors, fonts, logos and layouts. Built by hand, from a PowerPoint, or by an agent. Several brands, one default. Each brand keeps its own history.
- **Applying a look**: Only items linked to the look change. Items with their own style stay and are listed. One undo step. A deck keeps the version it applied; a newer version is offered, never forced.

## Steps and screens

| Step | Screen | Route | What happens | Goes to |
|---|---|---|---|---|
| 1 Choose a look | S05 Editor | /d/:id | The person or an agent picks a curated theme or one of their brands. Only the person starts a new brand. | 4, or 2 |
| 2 Build a brand | S10 Brand | /brands/:id | Colors, fonts, logos and layouts. Start by hand, from a PowerPoint's theme and masters (F05), or ask an agent to fill it in. Font files can be added. | 3 |
| 3 Check it | S10 Brand | /brands/:id | Sample slides show the brand. Checks flag color pairs with low contrast, fonts with no file or no right to embed, and logos too small to read. | 4 |
| 4 Use it | S05 Editor | /d/:id | Apply to this deck, make it the default for new decks, or both. Items with their own style stay and are listed. One undo step. | F03 or F08 |

New code in F11: S10 Brand. Next free codes are S11 and X5.

## When something goes wrong

| Item | Detail |
|---|---|
| PowerPoint with several masters | Each becomes a family of layouts. The person picks the main one. |
| Different slide size | Layouts adapt by their slots. Anything that does not fit is flagged. |
| Items with their own style | They stay as they are and are listed. An agent can link them to the brand. |
| Brand changes later | Decks using it are told a newer version exists. Nothing changes until someone applies it. |
| Brand deleted | Decks keep the version they have. New decks use the AirDesign default. |
| Font with no right to embed | Used in AirDesign. Export flags it (F04). |
| An agent edits the brand | Tagged like any change, in the brand's own history, and undoable. |

## Rules

- A look changes only what is linked to it. Content never moves or disappears.
- Applying a look is one undo step.
- Decks keep the brand version they applied. Updates are offered, never forced.
- Brands belong to the person and work across all their decks.
- Themes and brands are free. Agent help costs credits only on the AirDesign Agent.
- Both agents use get_brand and update_brand. A look is applied as one change set. New brands are made by the person.
- Target: a look applied to a 30-slide deck in under 2 s.
