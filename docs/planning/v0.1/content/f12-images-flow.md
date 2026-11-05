# F12 Images Flow

AirDesign / v0.1 / F12

F12 Images and assets

Bring images in, place them, adjust them. Originals never change, and every image is reusable across decks.

Screen

Other flow or outside

Decision

no

yes

search_assets, add_file

S40 Editor

1 Bring images in

Upload, paste, stock photos or icons.

X3 Your agent app

Or an agent finds them

Safe and fits?

F15

Told why. Not added.

S40 Editor

2 Place

In a layout slot or anywhere. Fills, centered on its focus.

S40 Editor

3 Adjust

Crop, focus, mask, replace. The original never changes.

F03

Edit and refine

F04

Export to PowerPoint

Where images come from, and where they live

Sources in v0.1

The person's own uploads, free stock photos, and an icon set. Generated images come later, and will spend credits.

One library per person

Every image belongs to the person, not to one deck. Stored once, reused anywhere, with its source and license.

Nothing destructive

Crop, focal point and mask are settings on the placed image. The original stays. Export uses the crop.

Steps and screens

Step

Screen

Route

What happens

Goes to

1 Bring images in

S40 Editor

/d/:id

Upload or paste files, search free stock photos, or pick an icon. Each image is checked, then joins the person's library with its source and license.

2, or F15

Or an agent finds them

X3 Your agent app

outside

Either agent calls search_assets, then add_file with the one it picks. The same checks apply.

2

2 Place

S40 Editor

/d/:id

Into a layout's image slot or anywhere on the slide. It fills the space, centered on its focal point. The agent writes alt text if there is none.

3

3 Adjust

S40 Editor

/d/:id

Crop, move the focal point, mask to a shape, or replace. The original never changes. Checks flag images too low in resolution for their size.

F03 or F04

Screens: S43.03 image picker. Not designed yet: personal library, crop and focal point, alt text.

When something goes wrong

Unsupported or unsafe file

Refused with the reason. SVGs are cleaned of scripts and outside links.

Phone photo or huge image

Converted and sized for slides. The original is kept.

Same image added twice

Stored once. Both places use it.

Removed while in use

Decks that use it keep it. It just leaves the library list.

Stock search finds nothing

The person or the agent is told, and can try other words.

Too small for its size

Flagged as blurry, never blocked.

Storage full

Told before upload, with what is using space.

Rules

Originals never change. Every edit is a setting.

Source and license are stored with every image. Where a license asks for credit, it goes into the slide notes.

Every image has alt text, from the person or the agent. It exports as PowerPoint alt text.

Every file is untrusted: read in the worker, with limits.

Images belong to the person and work across all their decks.

Stock photos and icons are free. Generated images come later and will cost credits.

Target: a placed image visible in under 1 s.
