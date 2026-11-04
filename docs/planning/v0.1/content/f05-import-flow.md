# F05 Import Flow

AirDesign / v0.1 / F05

F05 From a PowerPoint

Happy path only in v0.1 design: New deck, Import PowerPoint, then the deck shows on Home as a card that says Importing with progress, and opens when ready. No loading or ready screen. Edge cases are designed later with real files.

Screen

Other flow or outside

Decision

add_file, then import_deck

no

yes

none: no extra step

yes

S31 Home

1 Choose a PowerPoint

The person brings a .pptx.

X3 Your agent app

Or an agent imports it

S32.02 Home, importing

2 Read the file

In the worker, as untrusted. Every part lands native, kept or flagged.

Readable?

F15

Told why. Nothing saved.

Anything flagged?

S41.04 Grid, slides pasted

3 Review the import report

Only flagged items, each with its slide and what changed.

S40 Editor

4 Open the deck

Looks as it did in PowerPoint. Ready to edit.

F03

Edit or restyle with an agent

F11

Save it as a template

F04

Export to PowerPoint

What happens to each thing

The same three tiers as export, so a round trip loses nothing.

Native

Becomes editable in AirDesign

Text, shapes, images, tables, charts, groups, theme colors and fonts, masters and layouts with placeholders, speaker notes. The person and the agents can change all of it.

Kept

Kept whole, shown as it looks

SmartArt, animations and transitions, video and audio, embedded objects, comments, anything unknown. Shown with the preview stored in the file. It can be moved, resized or deleted, its content cannot be edited, and it goes back byte for byte on export.

Flagged

Changed, and always listed

A font AirDesign does not have shows with a close match, and the original name is kept for export. Macros are removed. Links to outside files are not followed.

Steps and screens

Step

Screen

Route

What happens

Goes to

1 Choose a PowerPoint

S31 Home

/home

New deck, then Import PowerPoint, picks a .pptx. The deck appears on Home at once as an Importing card with progress. If they came from the landing page with import as the intent, they arrive here after sign-in.

2

Or an agent imports it

X3 Your agent app

outside

The agent uploads the file with add_file, then calls import_deck. It gets the new deck and the same report, and tells the person what was flagged.

2

2 Read the file

S32 New deck

/home

The worker checks limits and reads every part as untrusted. Each part lands native, kept or flagged. The person can leave, the import keeps going.

3, 4, or F15

3 Review the import report

S32 New deck

/d/:id

No loading or ready page. Home shows the deck as Importing until it opens. Flagged items live in the import report, which the agent reads and explains when asked.

4

4 Open the deck

S40 Editor

/d/:id

A new deck that looks as it did in PowerPoint. Its theme and layouts become the deck theme; the default brand is not applied. The import report stays with the deck, for the person and the agents. Next: edit or restyle, save its look as a brand, or export.

F03, F11 or F04

Screens: S32.01 new deck menu, S32.02 importing on Home, S32.03 import failed on Home, S41.04 slides pasted in the grid. Import has no page of its own; a failed import shows on its deck card with Choose another file and Remove.

When something goes wrong

Password protected

Refused with the reason. Remove the password in PowerPoint and try again.

Old .ppt or Keynote

Not read in v0.1. The person is told to save it as .pptx first.

Over the limit

Refused before upload finishes, with the limit for size and slide count.

Broken or unsafe file

Refused. Nothing is saved and nothing outside is fetched.

Font not available

Fonts embedded in the file are used when allowed. Otherwise a close match is shown and the original name is kept. The person can add the font file to match exactly.

Agent tries to edit a kept item

Reads show it as kept, with why. A content change is refused with a clear error. It can still move, resize or delete it.

Kept item has no preview

Shown as a named placeholder at its size. Still kept and exported as it was. Flagged.

Same file imported again

Makes another new deck. Items left untouched in PowerPoint get their AirDesign data back. Replacing the original deck comes later.

They leave mid-import

The import keeps going. The deck is in their list when it is done.

Rules

It looks the same as in PowerPoint. Reference decks are checked on every change.

Nothing is lost. What AirDesign cannot edit, it keeps.

Round trip: export writes AirDesign data into the file. On import, anything untouched in PowerPoint gets its auto layout, roles and brand links back.

Kept means per item, not per slide. Edit a slide and its untouched kept items still go back byte for byte.

Every change is listed. Nothing silent.

No extra step when nothing is flagged.

Every file is untrusted: read in the worker, with limits, macros removed, no outside links followed.

The original file is stored privately. It is removed when the last deck using it leaves Trash (F14).

Import makes a new deck. Pasting slides copied from PowerPoint into an open deck also works, with the same three tiers and an Undo toast.

The person and both agents use the same import and the same report.

Import never uses weekly usage. Restyling with an agent does.

Target: a 50-slide file open in under 10 s.
