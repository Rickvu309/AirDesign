_AirDesign / v0.1 / F14_

# F14 Manage decks

Find, open, rename, duplicate, delete. Deleting always goes to Trash first.

## Flow

- **1 See all decks** (S04 Home)
- **What to do?**
- **Open it** (F03)
- **2 Rename** (S04 Home)
- **3 Duplicate** (S04 Home)
- **4 Delete** (S04 Home)
- **5 Trash, 30 days** (S04 Home, trash)
- **Restored?**
- **Back with its history** (Step 1)
- **Removed for good** (After 30 days, or Empty Trash)

Arrow labels: yes; no

## Steps and screens

| Failure | What is safe | Next step |
|---|---|---|
| 1 See all decks | S04 Home /home | Every deck they own, last opened first. Search covers titles, slide text and speaker notes. Goes to 2 to 4, or F03 to open one. |
| 2 Rename | S04 Home /home | The title changes everywhere at once, and names future exports. Agents can rename too. |
| 3 Duplicate | S04 Home /home | A new deck from the current version, named as a copy. Images and kept PowerPoint parts are shared, not copied. Agents do it with create_deck from a copy. |
| 4 Delete | S04 Home /home | The deck moves to Trash. Anyone with it open is told and it turns read-only. A running agent stops. Only the person can delete. Goes to 5. |
| 5 Trash, 30 days | S04 Home, trash /home/trash | Restore brings it back exactly, with its history. After 30 days, or on Empty Trash, it is removed with its history and exports. Its imported original goes too, once no other deck uses it. |

No new codes in F14. Trash is a state of S04 Home. Next free codes are S12 and X7.

## When something goes wrong

- Open in another tab when deleted: that tab is told and turns read-only.
- Agent running when deleted: the run stops. Its changes go to Trash with the deck.
- Agent asks to delete: refused in v0.1. It tells the person to do it.
- Large deck duplicated: done in the background. The person keeps working.
- Two decks with the same name: allowed. Each has its own id.
- Images used by a deleted deck: they stay in the library for other decks.

## Rules

- Deleting always goes to Trash first, except Empty Trash.
- Agents can list, open, rename and duplicate decks. Only the person deletes in v0.1.
- Duplicates share images and kept parts. Storage counts them once.
- Restore brings a deck back exactly, with its history.
- All of it is free. Folders come later.
