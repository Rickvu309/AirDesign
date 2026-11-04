# F14 Manage Decks Flow

AirDesign / v0.1 / F14

F14 Manage decks

Find, open, rename, duplicate, delete. Deleting always goes to Trash first.

yes

no

S31 Home

1 See all decks

What to do?

F03

Open it

S31 Home

2 Rename

S31 Home

3 Duplicate

S31 Home

4 Delete

S33.02 Trash

5 Trash, 30 days

Restored?

Step 1

Back with its history

After 30 days, or Empty Trash

Removed for good

Steps and screens

1 See all decks

S31 Home /home

Every deck they own, last edited first. Search covers titles, slide text and speaker notes. Goes to 2 to 4, or F03 to open one.

2 Rename

S31 Home /home

The title changes everywhere at once, and names future exports. Agents can rename too.

3 Duplicate

S31 Home /home

A new deck from the current version, named as a copy. Images and kept PowerPoint parts are shared, not copied. Agents do it with create_deck from a copy.

4 Delete

S31 Home /home

The deck moves to Trash, with a toast and Undo (S33.01). Other open tabs turn read-only. A running agent stops. Only the person can delete. Goes to 5.

5 Trash, 30 days

S33.02 Trash /home/trash

Each Trash card has Restore, which brings it back exactly, with its history. Empty Trash asks to confirm. After 30 days, or on Empty Trash, it is removed with its history and exports. Its imported original goes too, once no other deck uses it.

Screens: S31.02 to S31.05 recents and all decks, S33.01 deck trashed, S33.02 Trash, S33.03 confirm emptying.

When something goes wrong

Open in another tab when deleted: that tab is told and turns read-only.
Agent running when deleted: the run stops. Its changes go to Trash with the deck.
Agent asks to delete: refused in v0.1. It tells the person to do it.
Large deck duplicated: done in the background. The person keeps working.
Two decks with the same name: allowed. Each has its own id.
Images used by a deleted deck: they stay in the library for other decks.

Rules

Deleting always goes to Trash first, except Empty Trash.
Agents can list, open, rename and duplicate decks. Only the person deletes in v0.1.
Duplicates share images and kept parts. Storage counts them once.
Restore brings a deck back exactly, with its history.
All of it is free. Folders come later.
